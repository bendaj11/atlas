import { createHash } from 'node:crypto';
import { ArtifactoryClient } from '../artifactory-client/artifactory-client.js';
import type { ArtifactoryConnectionOptions } from '../artifactory-client/types.js';
import type {
  AtlasPublicationBody,
  AtlasPublicationLease,
  AtlasPublicationListedObject,
  AtlasPublicationObjectMetadata,
  AtlasPublicationReplaceCondition,
  AtlasPublicationStorage,
} from '../publication-storage/publication-storage.js';

export interface ArtifactoryOptions extends ArtifactoryConnectionOptions {
  /** Reject unless all writers to this repository/prefix are externally serialized for the entire command. */
  readonly assertExclusivePublishing: () => void | Promise<void>;
  /** Uploads and buffered reads are bounded; readStream does not buffer entire objects. */
  readonly maxBufferedBytes?: number;
}

type StorageClient = Pick<
  ArtifactoryClient,
  | 'readStream'
  | 'readPublicStream'
  | 'fileInfo'
  | 'metadata'
  | 'deliveryMetadata'
  | 'list'
  | 'upload'
  | 'remove'
>;

const DEFAULT_MAX_BUFFERED_BYTES = 256 * 1024 * 1024;

/** Artifactory-backed publication under an organization-owned, whole-command writer lock. */
export class ArtifactoryPublicationStorage implements AtlasPublicationStorage {
  private readonly client: StorageClient;
  private readonly maxBufferedBytes: number;
  private pendingMutation: Promise<void> = Promise.resolve();
  private unknownMutationFailure: unknown;

  constructor(
    private readonly options: ArtifactoryOptions,
    client?: StorageClient,
  ) {
    if (typeof options.assertExclusivePublishing !== 'function') {
      throw new Error(
        'Artifactory publication requires assertExclusivePublishing for external writer coordination.',
      );
    }

    this.maxBufferedBytes =
      options.maxBufferedBytes ?? DEFAULT_MAX_BUFFERED_BYTES;
    if (
      !Number.isSafeInteger(this.maxBufferedBytes) ||
      this.maxBufferedBytes <= 0
    ) {
      throw new Error(
        'Artifactory maxBufferedBytes must be a positive safe integer.',
      );
    }

    this.client = client ?? new ArtifactoryClient(options);
  }

  async read(path: string): Promise<Uint8Array | undefined> {
    const stream = await this.readStream(path);
    return stream ? collectBody(stream, this.maxBufferedBytes) : undefined;
  }

  readStream(path: string): Promise<AsyncIterable<Uint8Array> | undefined> {
    return this.client.readStream(path);
  }

  async inspect(
    path: string,
  ): Promise<AtlasPublicationObjectMetadata | undefined> {
    const info = await this.client.fileInfo(path);
    if (!info) return undefined;

    const headers = await this.client.metadata(path);
    return { ...info, ...headers };
  }

  async verifyDelivery(paths: readonly string[]): Promise<void> {
    for (const path of new Set(paths)) {
      const stored = await this.inspect(path);
      if (!stored?.versionToken || stored.size === undefined)
        throw new Error(`Artifactory object is missing from storage: ${path}`);

      const delivered = await this.client.deliveryMetadata(path);
      if (
        delivered.contentType !== stored.contentType ||
        delivered.cacheControl !== stored.cacheControl
      ) {
        throw new Error(
          'Artifactory delivery verification failed: Content-Type or Cache-Control do not match stored metadata.',
        );
      }
      await this.verifyPublicBytes(path, {
        size: stored.size,
        versionToken: stored.versionToken,
      });
    }
  }

  list(prefix: string): Promise<AtlasPublicationListedObject[]> {
    return this.client.list(prefix);
  }

  create(
    path: string,
    bytes: AtlasPublicationBody,
    metadata: AtlasPublicationObjectMetadata,
  ): Promise<void> {
    return this.serializeMutation(async () => {
      if (await this.client.fileInfo(path)) {
        throw new Error(`Artifactory object already exists: ${path}`);
      }

      await this.upload(path, bytes, metadata);
    });
  }

  replace(
    ...[path, bytes, metadata, condition]: Parameters<
      AtlasPublicationStorage['replace']
    >
  ): Promise<void> {
    return this.serializeMutation(async () => {
      const existing = await this.client.fileInfo(path);
      assertReplaceCondition(condition, existing?.versionToken);
      await this.upload(path, bytes, metadata);
    });
  }

  remove(path: string): Promise<void> {
    return this.serializeMutation(async () => {
      // FileInfo rejects folders; Artifactory DELETE on a folder would be recursive.
      if (!(await this.client.fileInfo(path))) return;

      await this.options.assertExclusivePublishing();
      await this.client.remove(path);
      await this.options.assertExclusivePublishing();
    });
  }

  async acquireLock(_owner: string): Promise<AtlasPublicationLease> {
    await this.options.assertExclusivePublishing();
    let released = false;

    return {
      assertHeld: async () => {
        if (released)
          throw new Error('Artifactory publication lease has been released.');
        await this.options.assertExclusivePublishing();
      },
      release: async () => {
        // The organization releases the outer lock only after the entire command exits.
        released = true;
      },
    };
  }

  private serializeMutation(operation: () => Promise<void>): Promise<void> {
    const mutation = this.pendingMutation.then(async () => {
      if (this.unknownMutationFailure !== undefined)
        throw this.unknownMutationFailure;

      await this.options.assertExclusivePublishing();
      await operation();
    });

    this.pendingMutation = mutation.catch((error: unknown) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'publicationOutcomeUnknown' in error &&
        error.publicationOutcomeUnknown === true
      )
        this.unknownMutationFailure = error;
    });
    return mutation;
  }

  private async upload(
    path: string,
    body: AtlasPublicationBody,
    metadata: AtlasPublicationObjectMetadata,
  ): Promise<void> {
    if (metadata.size !== undefined && metadata.size > this.maxBufferedBytes) {
      throw new Error('Artifactory object exceeds maxBufferedBytes.');
    }

    const bytes = await collectBody(body, this.maxBufferedBytes);
    if (metadata.size !== undefined && metadata.size !== bytes.byteLength) {
      throw new Error(
        'Artifactory upload size does not match publication metadata.',
      );
    }

    await this.options.assertExclusivePublishing();
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    await this.client.upload({
      path,
      bytes,
      contentType: metadata.contentType,
      cacheControl: metadata.cacheControl,
      sha256,
    });
    await this.options.assertExclusivePublishing();

    const published = await this.inspect(path);
    if (
      published?.versionToken !== sha256 ||
      published.size !== bytes.byteLength ||
      published.contentType !== metadata.contentType ||
      published.cacheControl !== metadata.cacheControl
    ) {
      throw new Error(
        'Artifactory publication verification failed: bytes, Content-Type, or Cache-Control do not match.',
      );
    }
    await this.options.assertExclusivePublishing();
  }

  private async verifyPublicBytes(
    path: string,
    expected: { size: number; versionToken: string },
  ): Promise<void> {
    const stream = await this.client.readPublicStream(path);
    if (!stream)
      throw new Error('Artifactory object is missing from public delivery.');

    const digest = createHash('sha256');
    let size = 0;
    for await (const chunk of stream) {
      size += chunk.byteLength;
      if (size > expected.size)
        throw new Error(
          'Artifactory public delivery size does not match stored object.',
        );
      digest.update(chunk);
    }

    if (
      size !== expected.size ||
      digest.digest('hex') !== expected.versionToken
    ) {
      throw new Error(
        'Artifactory public delivery bytes do not match stored object.',
      );
    }
  }
}

function assertReplaceCondition(
  condition: AtlasPublicationReplaceCondition,
  existing: string | undefined,
): void {
  if (
    condition.createOnly &&
    condition.versionToken === undefined &&
    existing === undefined
  )
    return;
  if (
    !condition.createOnly &&
    condition.versionToken &&
    condition.versionToken === existing
  )
    return;
  throw new Error('Artifactory replacement condition failed.');
}

async function collectBody(
  body: AtlasPublicationBody,
  maximumBytes: number,
): Promise<Buffer<ArrayBuffer>> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const stream = body instanceof Uint8Array ? [body] : body;

  for await (const chunk of stream) {
    size += chunk.byteLength;
    if (size > maximumBytes)
      throw new Error('Artifactory object exceeds maxBufferedBytes.');
    chunks.push(chunk);
  }

  return Buffer.concat(chunks, size);
}
