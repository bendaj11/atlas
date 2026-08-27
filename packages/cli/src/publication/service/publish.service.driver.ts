import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type {
  AtlasAppArtifactManifest,
  AtlasManifestDescriptor,
  AtlasRegistryArtifact,
  AtlasStaticRegistry,
} from '@atlas/schema';
import type { AtlasBuildResult } from '../../build/service/build.service.js';
import { CliArguments } from '../../cli/arguments.js';
import type {
  AtlasPublicationBody,
  AtlasPublicationLease,
  AtlasPublicationListedObject,
  AtlasPublicationObjectMetadata,
  AtlasPublicationReplaceCondition,
  AtlasPublicationStorage,
} from '../publication-storage/publication-storage.js';
import type { AtlasPreviewHeadResolver } from '../registry-config.js';
import type { AtlasArtifactPreviewState } from '../pr-state-file/pr-state-file.js';
import {
  canonicalJson,
  emptyStaticRegistry,
  registryRevision,
} from '../static-registry/static-registry.js';
import {
  AtlasPublishService,
  type AtlasProjectBuilder,
} from './publish.service.js';

export class PublishServiceDriver {
  private readonly id = faker.string.uuid();
  private readonly otherId = faker.string.uuid();
  private readonly name = faker.word.noun();
  private readonly storage = new MemoryPublicationStorage();
  private readonly publication = jest.fn<AtlasProjectBuilder['publication']>();
  private readonly resolvePreviewHead = jest.fn<AtlasPreviewHeadResolver>();
  private readonly progress: string[] = [];
  private verificationFailures = 0;
  private invalidationFailures = 0;
  private invalidationCalls = 0;
  private directory?: string;
  private result?: Awaited<ReturnType<AtlasPublishService['run']>>;
  private pruneResult?: Awaited<
    ReturnType<AtlasPublishService['prunePreviews']>
  >;
  private removalResult?: Awaited<
    ReturnType<AtlasPublishService['removePreview']>
  >;
  private bytes = new TextEncoder().encode(faker.string.alphanumeric(24));
  private dryRun = false;
  private selector: { version?: string; preview?: number } = {
    version: '1.4.0',
  };

  given = {
    release: (version = '1.4.0'): void => {
      this.selector = { version };
    },
    preview: (number = 123): void => {
      this.selector = { preview: number };
      this.resolvePreviewHead.mockImplementation(async () => ({
        state: 'open' as const,
        headSha: 'abc123',
      }));
    },
    changedBytes: (): void => {
      this.bytes = new TextEncoder().encode(faker.string.alphanumeric(25));
    },
    dryRun: (): void => {
      this.dryRun = true;
    },
    transientVerificationFailure: (): void => {
      this.verificationFailures = 1;
    },
    transientInvalidationFailure: (): void => {
      this.invalidationFailures = 1;
    },
    previewPruning: (): void => {
      const registry = emptyStaticRegistry('2026-01-01T00:00:00.000Z');
      registry.apps[this.id] = this.registryArtifact(this.id, [1, 2]);
      registry.apps[this.otherId] = this.registryArtifact(this.otherId, [2]);
      registry.revision = registryRevision(registry) as `sha256:${string}`;
      this.storage.seed(
        'registry.json',
        new TextEncoder().encode(`${canonicalJson(registry)}\n`),
      );
      this.storage.seed(
        this.orphanPath(this.id),
        new Uint8Array(),
        '2025-01-01T00:00:00.000Z',
      );
      this.storage.seed(
        this.orphanPath(this.otherId),
        new Uint8Array(),
        '2025-01-01T00:00:00.000Z',
      );
    },
  };

  when = {
    publish: async (): Promise<void> => {
      this.directory ??= await mkdtemp(join(tmpdir(), 'atlas-publish-test-'));
      await writeFile(join(this.directory, 'remoteEntry.json'), this.bytes);
      this.publication.mockImplementation(async () => this.buildResult());
      const values = this.selector.version
        ? ['publish', this.name, '--version', this.selector.version]
        : ['publish', this.name, '--pr', String(this.selector.preview)];
      if (this.dryRun) values.push('--dry-run');
      this.result = await new AtlasPublishService(
        new CliArguments(values),
        { publication: this.publication },
        (message) => this.progress.push(message),
      ).run(this.name, {
        storage: this.storage,
        resolvePreviewHead: this.resolvePreviewHead,
        verifyRegistry: async () => {
          if (this.verificationFailures-- > 0) {
            throw { $metadata: { httpStatusCode: 503 } };
          }
        },
      });
    },
    cleanup: async (): Promise<void> => {
      if (this.directory)
        await rm(this.directory, { recursive: true, force: true });
    },
    prune: async (): Promise<void> => {
      const states: readonly AtlasArtifactPreviewState[] = [
        { kind: 'app', id: this.id, openPreviews: new Set([1]) },
      ];
      this.pruneResult = await new AtlasPublishService(
        new CliArguments(['prune-previews']),
      ).prunePreviews(states, {
        storage: this.storage,
        invalidate: async () => {
          this.invalidationCalls += 1;
          if (this.invalidationFailures-- > 0) {
            throw { $metadata: { httpStatusCode: 503 } };
          }
        },
      });
    },
    removePreview: async (): Promise<void> => {
      this.removalResult = await new AtlasPublishService(
        new CliArguments(['remove-preview']),
      ).removePreview(this.id, 1, {
        storage: this.storage,
        invalidate: async () => {
          this.invalidationCalls += 1;
          if (this.invalidationFailures-- > 0) {
            throw { $metadata: { httpStatusCode: 503 } };
          }
        },
      });
    },
  };

  get = {
    result: () => this.result,
    name: (): string => this.name,
    identity: (): string =>
      `app ${this.name} (${this.id}), release ${this.selector.version}`,
    registry: (): AtlasStaticRegistry =>
      JSON.parse(
        new TextDecoder().decode(this.storage.required('registry.json').bytes),
      ) as AtlasStaticRegistry,
    paths: (): string[] => [...this.storage.paths()].sort(),
    progress: (): readonly string[] => this.progress,
    resolverCalls: (): number => this.resolvePreviewHead.mock.calls.length,
    publicationAttempts: (): number => this.publication.mock.calls.length,
    prunedSelections: (): Record<string, string[]> => ({
      scoped: Object.keys(this.get.registry().apps[this.id]!.previews),
      unscoped: Object.keys(this.get.registry().apps[this.otherId]!.previews),
    }),
    pruneRetry: (): { removed: number | undefined; invalidations: number } => ({
      removed: this.pruneResult?.removed,
      invalidations: this.invalidationCalls,
    }),
    removalRetry: (): { removed: boolean | undefined; invalidations: number } => ({
      removed: this.removalResult?.removed,
      invalidations: this.invalidationCalls,
    }),
    prunedOrphans: (): {
      removedGenerations: number | undefined;
      scopedExists: boolean;
      unscopedExists: boolean;
    } => ({
      removedGenerations: this.pruneResult?.removedGenerations,
      scopedExists: this.storage.has(this.orphanPath(this.id)),
      unscopedExists: this.storage.has(this.orphanPath(this.otherId)),
    }),
  };

  private registryArtifact(
    id: string,
    previews: readonly number[],
  ): AtlasRegistryArtifact {
    return {
      id,
      name: id,
      releases: {},
      previews: Object.fromEntries(
        previews.map((number) => [number, this.previewDescriptor(id, number)]),
      ),
    };
  }

  private previewDescriptor(
    id: string,
    number: number,
  ): AtlasManifestDescriptor {
    return {
      path: `apps/${id}/previews/${number}/${'a'.repeat(64)}/manifest.json`,
      digest: `sha256:${'b'.repeat(64)}`,
      size: 1,
      mediaType: 'application/json',
    };
  }

  private orphanPath(id: string): string {
    return `apps/${id}/previews/999/${'c'.repeat(64)}/manifest.json`;
  }

  private buildResult(): AtlasBuildResult {
    const digest =
      `sha256:${createHash('sha256').update(this.bytes).digest('hex')}` as const;
    const manifest: AtlasAppArtifactManifest = {
      schemaVersion: '2',
      kind: 'app-artifact',
      id: this.id,
      name: this.name,
      ...(this.selector.version
        ? { release: { version: this.selector.version } }
        : { preview: { number: this.selector.preview!, gitSha: 'abc123' } }),
      framework: 'react',
      entryPath: 'remoteEntry.json',
      exposes: { entry: './entry' },
      files: [
        {
          path: 'remoteEntry.json',
          digest,
          size: this.bytes.byteLength,
          mediaType: 'application/json',
          cacheControl: 'public, max-age=31536000, immutable',
          role: 'remote-entry',
        },
      ],
      requiredHostSdkVersion: '^0.1.0',
      supportedHosts: ['*'],
      placements: [],
    };
    return {
      artifact: 'app',
      manifest,
      project: {} as AtlasBuildResult['project'],
      sourceDirectory: this.directory!,
      files: ['remoteEntry.json'],
    };
  }
}

interface StoredObject {
  bytes: Uint8Array;
  metadata: AtlasPublicationObjectMetadata;
  token: string;
}

class MemoryPublicationStorage implements AtlasPublicationStorage {
  private readonly objects = new Map<string, StoredObject>();

  async read(path: string): Promise<Uint8Array | undefined> {
    return this.objects.get(path)?.bytes;
  }

  async readStream(
    path: string,
  ): Promise<AsyncIterable<Uint8Array> | undefined> {
    const bytes = await this.read(path);
    if (!bytes) return undefined;
    return (async function* () {
      yield bytes;
    })();
  }

  async inspect(
    path: string,
  ): Promise<AtlasPublicationObjectMetadata | undefined> {
    const object = this.objects.get(path);
    return object
      ? {
          ...object.metadata,
          size: object.bytes.byteLength,
          versionToken: object.token,
        }
      : undefined;
  }

  async list(prefix: string): Promise<AtlasPublicationListedObject[]> {
    return [...this.objects]
      .filter(([path]) => path.startsWith(prefix))
      .map(([path, object]) => ({
        path,
        size: object.bytes.byteLength,
        ...(object.metadata.lastModified
          ? { lastModified: object.metadata.lastModified }
          : {}),
      }));
  }

  async create(
    path: string,
    body: AtlasPublicationBody,
    metadata: AtlasPublicationObjectMetadata,
  ): Promise<void> {
    if (this.objects.has(path)) throw new Error('exists');
    this.objects.set(path, {
      bytes: await collect(body),
      metadata,
      token: faker.string.uuid(),
    });
  }

  async replace(
    path: string,
    body: AtlasPublicationBody,
    metadata: AtlasPublicationObjectMetadata,
    condition: AtlasPublicationReplaceCondition,
  ): Promise<void> {
    const existing = this.objects.get(path);
    if (condition.createOnly && existing) throw new Error('conflict');
    if (condition.versionToken && existing?.token !== condition.versionToken) {
      throw new Error('conflict');
    }
    this.objects.set(path, {
      bytes: await collect(body),
      metadata,
      token: faker.string.uuid(),
    });
  }

  async remove(path: string): Promise<void> {
    this.objects.delete(path);
  }

  async acquireLock(): Promise<AtlasPublicationLease> {
    return {
      assertHeld: async () => undefined,
      release: async () => undefined,
    };
  }

  required(path: string): StoredObject {
    const object = this.objects.get(path);
    if (!object) throw new Error(`Missing ${path}`);
    return object;
  }

  paths(): IterableIterator<string> {
    return this.objects.keys();
  }

  has(path: string): boolean {
    return this.objects.has(path);
  }

  seed(path: string, bytes: Uint8Array, lastModified?: string): void {
    this.objects.set(path, {
      bytes,
      metadata: {
        cacheControl: 'no-cache',
        contentType: 'application/json',
        ...(lastModified ? { lastModified } : {}),
      },
      token: faker.string.uuid(),
    });
  }
}

async function collect(body: AtlasPublicationBody): Promise<Uint8Array> {
  if (body instanceof Uint8Array) return body;
  const chunks: Uint8Array[] = [];
  for await (const chunk of body) chunks.push(chunk);
  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
