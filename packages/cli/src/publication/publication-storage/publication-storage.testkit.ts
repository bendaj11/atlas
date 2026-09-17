import type {
  AtlasPublicationLease,
  AtlasPublicationListedObject,
  AtlasPublicationObjectMetadata,
  AtlasPublicationStorage,
} from './types.js';

interface StoredObject {
  bytes: Uint8Array;
  metadata: AtlasPublicationObjectMetadata;
}

export class InMemoryPublicationStorage implements AtlasPublicationStorage {
  readonly objects = new Map<string, StoredObject>();
  readonly removed: string[] = [];
  private version = 0;

  async read(path: string): Promise<Uint8Array | undefined> {
    return this.objects.get(path)?.bytes;
  }

  async readStream(
    path: string,
  ): Promise<AsyncIterable<Uint8Array> | undefined> {
    const bytes = await this.read(path);

    return bytes ? toAsyncIterable(bytes) : undefined;
  }

  async inspect(
    path: string,
  ): Promise<AtlasPublicationObjectMetadata | undefined> {
    return this.objects.get(path)?.metadata;
  }

  async list(prefix: string): Promise<AtlasPublicationListedObject[]> {
    return [...this.objects.entries()]
      .filter(([path]) => path.startsWith(prefix))
      .map(([path, { bytes, metadata }]) => ({
        path,
        size: bytes.byteLength,
        ...(metadata.lastModified
          ? { lastModified: metadata.lastModified }
          : {}),
      }));
  }

  async create(
    path: string,
    bytes: Uint8Array | AsyncIterable<Uint8Array>,
    metadata: AtlasPublicationObjectMetadata,
  ): Promise<void> {
    if (this.objects.has(path))
      throw new Error(`Immutable publication object already exists: ${path}`);
    this.put(path, bytes, metadata);
  }

  async replace(
    path: string,
    bytes: Uint8Array | AsyncIterable<Uint8Array>,
    metadata: AtlasPublicationObjectMetadata,
    condition: { versionToken?: string; createOnly?: boolean },
  ): Promise<void> {
    const current = this.objects.get(path);
    if (condition.createOnly && current)
      throw new Error(`Conditional publication write conflicted: ${path}`);
    if (
      condition.versionToken &&
      current?.metadata.versionToken !== condition.versionToken
    )
      throw new Error(`Conditional publication write conflicted: ${path}`);
    this.put(path, bytes, metadata);
  }

  async remove(path: string): Promise<void> {
    this.objects.delete(path);
    this.removed.push(path);
  }

  async acquireLock(): Promise<AtlasPublicationLease> {
    return {
      assertHeld: async () => undefined,
      release: async () => undefined,
    };
  }

  seed(
    path: string,
    bytes: Uint8Array | string,
    metadata: Partial<AtlasPublicationObjectMetadata> = {},
  ): void {
    this.put(
      path,
      typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes,
      {
        cacheControl: 'no-cache',
        contentType: 'application/json',
        ...metadata,
      },
    );
  }

  private put(
    path: string,
    bytes: Uint8Array | AsyncIterable<Uint8Array>,
    metadata: AtlasPublicationObjectMetadata,
  ): void {
    if (!(bytes instanceof Uint8Array))
      throw new Error('In-memory storage accepts byte arrays only.');
    this.version += 1;
    this.objects.set(path, {
      bytes,
      metadata: { ...metadata, versionToken: `v${this.version}` },
    });
  }
}

async function* toAsyncIterable(bytes: Uint8Array): AsyncIterable<Uint8Array> {
  yield bytes;
}
