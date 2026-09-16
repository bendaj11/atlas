import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type {
  AtlasEnvironmentDeployment,
  AtlasHostDeploymentManifest,
  AtlasManifestDescriptor,
  AtlasPublishedArtifactManifest,
  AtlasStaticRegistry,
} from '@atlas/schema';
import {
  aHostArtifactManifest,
  anAppArtifactManifest,
  anEnvironmentDeployment,
} from '@atlas/testkit';
import { CliArguments } from '../cli/arguments.js';
import type {
  AtlasPublicationBody,
  AtlasPublicationLease,
  AtlasPublicationListedObject,
  AtlasPublicationObjectMetadata,
  AtlasPublicationReplaceCondition,
  AtlasPublicationStorage,
} from '../publication/publication-storage/publication-storage.js';
import {
  descriptorFor,
  manifestBytes,
  publishArtifact,
} from '../publication/static-registry/static-registry.js';
import {
  AtlasDeployService,
  type AtlasDeployResult,
} from './deploy.service.js';

const MUTABLE = 'no-cache, max-age=0, must-revalidate';

export class DeployServiceDriver {
  private readonly storage = new MemoryStorage();
  private readonly sourceRoot = 'https://source.example/atlas';
  private readonly targetRoot = 'https://target.example/atlas';
  private readonly hostId = faker.string.uuid();
  private readonly appId = faker.string.uuid();
  private readonly host = aHostArtifactManifest({
    id: this.hostId,
    release: { version: '1.0.0' },
  });
  private readonly app = anAppArtifactManifest({
    id: this.appId,
    release: { version: '1.4.0' },
    supportedHosts: [this.hostId],
    placements: [
      {
        id: faker.string.uuid(),
        kind: 'route',
        hostId: this.hostId,
        route: { path: `/${faker.word.noun()}`, title: faker.lorem.words() },
      },
    ],
  });
  private readonly source = new Map<string, Uint8Array>();
  private readonly originalFetch = globalThis.fetch;
  private selector = '1.4.0';
  private targetEnvironment = 'production';
  private separateRegistries = false;
  private invalidFlags = false;
  private dryRun = false;
  private insecureRegistry = false;
  private invalidations: string[] = [];
  private invalidationFailures = 0;
  private permanentInvalidationFailures = 0;
  private deliveryFailures = 0;
  private readonly deliveryEvents: string[] = [];
  private readonly cachedObjects = new Map<string, Uint8Array>();
  private result?: AtlasDeployResult;

  given = {
    deliveryCache: (
      failure: 'none' | 'invalidate-once' | 'verify-once',
    ): void => {
      this.permanentInvalidationFailures =
        failure === 'invalidate-once' ? 1 : 0;
      this.deliveryFailures = failure === 'verify-once' ? 1 : 0;
      this.storage.verifyDelivery = jest
        .fn<NonNullable<AtlasPublicationStorage['verifyDelivery']>>()
        .mockImplementation(async (paths) => {
          this.deliveryEvents.push('verify');
          if (this.deliveryFailures-- > 0)
            throw new Error('Delivery unavailable');
          for (const path of paths) {
            const stored = await this.storage.read(path);
            const cached = this.cachedObjects.get(path);
            if (
              !stored ||
              !cached ||
              Buffer.compare(Buffer.from(stored), Buffer.from(cached)) !== 0
            )
              throw new Error('Stale delivery cache');
          }
        });
    },
    catalog: async (): Promise<void> => {
      const registry = await this.catalogFor(this.storage);
      await this.storage.seedJson('registry.json', registry);
      await this.storage.seedJson(
        'environments/production/deployment.json',
        anEnvironmentDeployment({
          environment: 'production',
          hosts: { [this.hostId]: { version: '1.0.0' } },
        }),
      );
    },
    latest: (): void => {
      this.selector = 'latest';
    },
    sourceEnvironment: async (): Promise<void> => {
      await this.storage.seedJson(
        'environments/staging/deployment.json',
        anEnvironmentDeployment({
          environment: 'staging',
          hosts: { [this.hostId]: { version: '1.0.0' } },
          apps: { [this.appId]: { version: '1.4.0' } },
        }),
      );
      this.selector = 'staging';
    },
    separateRegistries: async (): Promise<void> => {
      this.storage.clear();
      const sourceStorage = new MemoryStorage();
      const registry = await this.catalogFor(sourceStorage);
      this.source.set('registry.json', jsonBytes(registry));
      for (const path of sourceStorage.paths())
        this.source.set(path, (await sourceStorage.read(path))!);
      await this.storage.seedJson(
        'environments/production/deployment.json',
        anEnvironmentDeployment({
          environment: 'production',
          hosts: { [this.hostId]: { version: '1.0.0' } },
        }),
      );
      globalThis.fetch = async (input) =>
        this.sourceResponse(requestUrl(input));
      this.separateRegistries = true;
    },
    conflictingFlags: (): void => {
      this.invalidFlags = true;
    },
    dryRun: (): void => {
      this.dryRun = true;
    },
    malformedTargetState: async (): Promise<void> => {
      await this.storage.seedJson('environments/production/deployment.json', {
        schemaVersion: 'v1',
      });
    },
    insecureRegistry: (): void => {
      this.insecureRegistry = true;
    },
    transientInvalidationFailure: (): void => {
      this.invalidationFailures = 1;
    },
  };

  when = {
    deploy: async (): Promise<void> => {
      this.result = await new AtlasDeployService(this.arguments()).run(
        this.appId,
        {
          storage: this.storage,
          invalidate: async (paths) => {
            this.invalidations.push(...paths);
            this.deliveryEvents.push('invalidate');
            if (this.invalidationFailures-- > 0) {
              throw { $metadata: { httpStatusCode: 503 } };
            }
            if (this.permanentInvalidationFailures-- > 0)
              throw new Error('Cache refresh unavailable');
            for (const path of paths) {
              const bytes = await this.storage.read(path);
              if (bytes) this.cachedObjects.set(path, bytes);
            }
          },
        },
      );
    },
    cleanup: (): void => {
      globalThis.fetch = this.originalFetch;
    },
  };

  get = {
    deliveryEvents: (): string[] => this.deliveryEvents,
    result: (): AtlasDeployResult | undefined => this.result,
    selectedAppVersion: (): string | undefined =>
      this.storage.json<AtlasEnvironmentDeployment>(
        'environments/production/deployment.json',
      ).apps[this.appId]?.version,
    activeManifest: (): AtlasHostDeploymentManifest =>
      this.storage.json(
        `environments/production/hosts/${this.hostId}/manifest.json`,
      ),
    targetArtifactPaths: (): string[] =>
      this.storage
        .paths()
        .filter(
          (path) => path.startsWith('apps/') || path.startsWith('hosts/'),
        ),
    invalidations: (): string[] => this.invalidations,
    deployError: async (): Promise<unknown> => {
      try {
        await this.when.deploy();
      } catch (error) {
        return error;
      }
      return undefined;
    },
  };

  private arguments(): CliArguments {
    const roots = this.separateRegistries
      ? [
          '--source-registry-url',
          this.sourceRoot,
          '--target-registry-url',
          this.targetRoot,
        ]
      : [
          '--registry-url',
          this.insecureRegistry
            ? 'http://registry.example/atlas'
            : this.targetRoot,
        ];
    return new CliArguments([
      'deploy',
      this.appId,
      '--to',
      this.targetEnvironment,
      '--version',
      this.selector,
      ...roots,
      ...(this.invalidFlags ? ['--source-registry-url', this.sourceRoot] : []),
      ...(this.dryRun ? ['--dry-run'] : []),
    ]);
  }

  private async catalogFor(
    storage: MemoryStorage,
  ): Promise<AtlasStaticRegistry> {
    const hostDescriptor = await this.store(storage, this.host);
    const appDescriptor = await this.store(storage, this.app);
    return publishArtifact(
      publishArtifact(undefined, this.host, hostDescriptor).registry,
      this.app,
      appDescriptor,
    ).registry;
  }

  private async store(
    storage: MemoryStorage,
    manifest: AtlasPublishedArtifactManifest,
  ): Promise<AtlasManifestDescriptor> {
    const collection = manifest.kind === 'app-artifact' ? 'apps' : 'hosts';
    const path = `${collection}/${manifest.id}/${manifest.release!.version}/manifest.json`;
    const bytes = manifestBytes(manifest);
    await storage.seed(path, bytes);
    return descriptorFor(path, bytes);
  }

  private sourceResponse(url: string): Response {
    const root = `${this.sourceRoot}/`;
    const path = url.startsWith(root) ? url.slice(root.length) : '';
    const bytes = this.source.get(path);
    return bytes
      ? new Response(new TextDecoder().decode(bytes), { status: 200 })
      : new Response(null, { status: 404 });
  }
}

class MemoryStorage implements AtlasPublicationStorage {
  verifyDelivery?: AtlasPublicationStorage['verifyDelivery'];
  private readonly objects = new Map<string, Uint8Array>();
  async read(path: string): Promise<Uint8Array | undefined> {
    return this.objects.get(path);
  }
  async readStream(
    path: string,
  ): Promise<AsyncIterable<Uint8Array> | undefined> {
    const bytes = await this.read(path);
    return bytes
      ? (async function* () {
          yield bytes;
        })()
      : undefined;
  }
  async inspect(
    path: string,
  ): Promise<AtlasPublicationObjectMetadata | undefined> {
    const bytes = await this.read(path);
    return bytes
      ? {
          cacheControl: MUTABLE,
          contentType: 'application/json',
          versionToken: path,
          size: bytes.byteLength,
        }
      : undefined;
  }
  async list(prefix: string): Promise<AtlasPublicationListedObject[]> {
    return this.paths()
      .filter((path) => path.startsWith(prefix))
      .map((path) => ({ path, size: this.objects.get(path)!.byteLength }));
  }
  async create(path: string, body: AtlasPublicationBody): Promise<void> {
    if (this.objects.has(path)) throw new Error('object exists');
    await this.seed(path, await collect(body));
  }
  async replace(
    path: string,
    body: AtlasPublicationBody,
    _metadata: AtlasPublicationObjectMetadata,
    _condition: AtlasPublicationReplaceCondition,
  ): Promise<void> {
    await this.seed(path, await collect(body));
  }
  async remove(path: string): Promise<void> {
    this.objects.delete(path);
  }
  async acquireLock(_owner: string): Promise<AtlasPublicationLease> {
    return {
      assertHeld: async () => undefined,
      release: async () => undefined,
    };
  }
  async seed(path: string, bytes: Uint8Array): Promise<void> {
    this.objects.set(path, bytes);
  }
  async seedJson(path: string, value: unknown): Promise<void> {
    await this.seed(path, jsonBytes(value));
  }
  json<T>(path: string): T {
    const bytes = this.objects.get(path);
    if (!bytes) throw new Error(`Missing ${path}`);
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  }
  paths(): string[] {
    return [...this.objects.keys()];
  }
  clear(): void {
    this.objects.clear();
  }
}

async function collect(body: AtlasPublicationBody): Promise<Uint8Array> {
  if (body instanceof Uint8Array) return body;
  const chunks: Uint8Array[] = [];
  for await (const chunk of body) chunks.push(chunk);
  return new Uint8Array(chunks.flatMap((chunk) => [...chunk]));
}
function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}
function requestUrl(input: Parameters<typeof fetch>[0]): string {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}
