import { createHash } from 'node:crypto';
import { jest } from '@jest/globals';
import type {
  AtlasAppArtifactManifest,
  AtlasHostArtifactManifest,
  AtlasHostDeploymentManifest,
  AtlasPublishedArtifactManifest,
  AtlasStaticRegistry,
} from '@atlas/schema';
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
  registryRevision,
  selectDeployment,
  resolveRelease,
} from '../publication/static-registry/static-registry.js';
import {
  AtlasDeploymentConvergenceError,
  AtlasDeployService,
  type AtlasDeployResult,
} from './deploy.service.js';

const IMMUTABLE = 'public, max-age=31536000, immutable';
const MUTABLE = 'no-cache, max-age=0, must-revalidate';

interface CrossRegistryTransfer {
  readonly version: string | undefined;
  readonly manifestDigest: string | undefined;
  readonly payloadDigest: string;
  readonly streamed: boolean;
}

export class DeployServiceDriver {
  private readonly storage = new MemoryDeployStorage();
  private readonly app = appManifest();
  private readonly host = hostManifest();
  private readonly unrelatedHost = hostManifest({
    id: '7c1d7bc9-d759-4904-a95c-28cd7a5639e1',
    name: 'unrelated-shell',
  });
  private readonly originalFetch = globalThis.fetch;
  private readonly sourceRoot = 'https://source.example/atlas';
  private readonly responses = new Map<string, () => Response>();
  private readonly fetchResource = jest.fn<typeof fetch>();
  private selector = '1.4.0';
  private environment = 'production';
  private result?: AtlasDeployResult;
  private readonly results: AtlasDeployResult[] = [];
  private readonly desiredVersions: Array<string | undefined> = [];
  private readonly activeAfterDeploy: boolean[] = [];
  private sourceRegistry = false;
  private dryRun = false;
  private expectedManifestDigest?: string;
  private sourceManifestPath?: string;
  private sourceRegistrySnapshot?: AtlasStaticRegistry;
  private convergenceFailed = false;
  private targetRoot = 'http://localhost:4400';

  given = {
    registry: async (): Promise<void> => {
      const hostDescriptor = await this.storeArtifact(this.host);
      const appDescriptor = await this.storeArtifact(this.app);
      let registry = publishArtifact(
        undefined,
        this.host,
        hostDescriptor,
      ).registry;
      registry = publishArtifact(registry, this.app, appDescriptor).registry;
      const selectedHost = resolveRelease(registry, this.host.id, '1.0.0');
      registry = selectDeployment(
        registry,
        'production',
        selectedHost,
        {},
      ).registry;
      await this.storage.seedJson('registry.json', registry, MUTABLE);
    },
    registryWithUnrelatedHost: async (): Promise<void> => {
      await this.seedRegistryWithHosts(this.app);
    },
    registryWithWildcardPlacement: async (): Promise<void> => {
      await this.seedRegistryWithHosts(
        appManifest({
          supportedHosts: ['*'],
          placements: [
            {
              id: 'orders-route',
              kind: 'route',
              hostId: '*',
              route: { path: '/orders', title: 'Orders' },
            },
          ],
        }),
      );
    },
    previouslyDeployedApp: async (): Promise<void> => {
      this.storage.clear();
      const nextApp = appManifest({
        release: { version: '1.5.0' },
        supportedHosts: ['*'],
        placements: [],
      });
      const hostDescriptor = await this.storeArtifact(this.host);
      const currentAppDescriptor = await this.storeArtifact(this.app);
      const nextAppDescriptor = await this.storeArtifact(nextApp);
      let registry = publishArtifact(
        undefined,
        this.host,
        hostDescriptor,
      ).registry;
      registry = publishArtifact(
        registry,
        this.app,
        currentAppDescriptor,
      ).registry;
      registry = publishArtifact(registry, nextApp, nextAppDescriptor).registry;
      registry = selectDeployment(
        registry,
        'production',
        resolveRelease(registry, this.host.id, '1.0.0'),
        {},
      ).registry;
      registry = selectDeployment(
        registry,
        'production',
        resolveRelease(registry, this.app.id, '1.4.0'),
        {},
      ).registry;
      await this.storage.seedJson('registry.json', registry, MUTABLE);
      this.selector = '1.5.0';
    },
    widgetProvider: async (): Promise<void> => {
      this.storage.clear();
      this.app.placements = [];
      this.app.supportedHosts = ['*'];
      const consumer = appManifest({
        id: '20b68dd4-f18c-4811-8768-b636ce559df6',
        name: 'checkout',
        externalAppsDependencies: [this.app.id],
      });
      const hostDescriptor = await this.storeArtifact(this.host);
      const providerDescriptor = await this.storeArtifact(this.app);
      const consumerDescriptor = await this.storeArtifact(consumer);
      let registry = publishArtifact(
        undefined,
        this.host,
        hostDescriptor,
      ).registry;
      registry = publishArtifact(
        registry,
        this.app,
        providerDescriptor,
      ).registry;
      registry = publishArtifact(
        registry,
        consumer,
        consumerDescriptor,
      ).registry;
      registry = selectDeployment(
        registry,
        'production',
        resolveRelease(registry, this.host.id, '1.0.0'),
        {},
      ).registry;
      registry = selectDeployment(
        registry,
        'production',
        resolveRelease(registry, consumer.id, '1.4.0'),
        {},
      ).registry;
      await this.storage.seedJson('registry.json', registry, MUTABLE);
    },
    sourceEnvironment: async (): Promise<void> => {
      const registry = this.registry();
      const selected = resolveRelease(registry, this.app.id, '1.4.0');
      const next = selectDeployment(registry, 'rc', selected, {}).registry;
      await this.storage.seedJson('registry.json', next, MUTABLE);
      this.selector = 'rc';
    },
    latest: (): void => {
      this.selector = 'latest';
    },
    targetEnvironment: async (environment: string): Promise<void> => {
      const registry = this.registry();
      const selectedHost = resolveRelease(registry, this.host.id, '1.0.0');
      const next = selectDeployment(
        registry,
        environment,
        selectedHost,
        {},
      ).registry;
      await this.storage.seedJson('registry.json', next, MUTABLE);
      this.environment = environment;
    },
    crossRegistry: async (): Promise<void> => {
      this.storage.clear();
      const hostDescriptor = await this.storeArtifact(this.host);
      let target = publishArtifact(
        undefined,
        this.host,
        hostDescriptor,
      ).registry;
      target = selectDeployment(
        target,
        'production',
        resolveRelease(target, this.host.id, '1.0.0'),
        {},
      ).registry;
      await this.storage.seedJson('registry.json', target, MUTABLE);

      const manifest = manifestBytes(this.app);
      const descriptor = descriptorFor(
        `apps/${this.app.id}/1.4.0/manifest.json`,
        manifest,
      );
      const source = publishArtifact(undefined, this.app, descriptor).registry;
      this.sourceManifestPath = descriptor.path;
      this.sourceRegistrySnapshot = source;
      this.expectedManifestDigest = descriptor.digest;
      this.respond(`${this.sourceRoot}/registry.json`, jsonResponse(source));
      this.respond(
        `${this.sourceRoot}/${descriptor.path}`,
        bytesResponse(manifest, 'application/json'),
      );
      this.respond(
        `${this.sourceRoot}/apps/${this.app.id}/1.4.0/remoteEntry.json`,
        streamedResponse(APP_ENTRY, 'application/json; charset=utf-8'),
      );
      this.fetchResource.mockImplementation(async (input) => {
        const url = requestUrl(input);
        const response = this.responses.get(url);
        if (!response) throw new Error(`Unexpected request: ${url}`);
        return response();
      });
      globalThis.fetch = this.fetchResource;
      this.sourceRegistry = true;
    },
    projectionFailure: (): void => {
      this.storage.failNextProjectionWrites(3);
    },
    dryRun: (): void => {
      this.dryRun = true;
    },
    sourceRedirect: (): void => {
      this.respond(
        `${this.sourceRoot}/registry.json`,
        () => new Response(null, { status: 302, headers: { location: '/' } }),
      );
    },
    invalidPayloadMetadata: (): void => {
      this.respond(
        `${this.sourceRoot}/apps/${this.app.id}/1.4.0/remoteEntry.json`,
        bytesResponse(APP_ENTRY, 'text/plain'),
      );
    },
    concurrentPayloadWithInvalidMetadata: (): void => {
      this.storage.conflictNextCreate(
        `apps/${this.app.id}/1.4.0/remoteEntry.json`,
        APP_ENTRY,
        { cacheControl: 'no-cache', contentType: 'application/json' },
      );
    },
    insecureTarget: (): void => {
      this.targetRoot = 'http://registry.example';
    },
    mismatchedManifestIdentity: (): void => {
      if (!this.sourceManifestPath || !this.sourceRegistrySnapshot) {
        throw new Error('Cross-registry source must be configured first.');
      }
      const mismatched = manifestBytes({
        ...this.app,
        id: '5d60fba1-a286-4c31-8c55-f743afe397b2',
      });
      const descriptor = descriptorFor(this.sourceManifestPath, mismatched);
      const source = structuredClone(this.sourceRegistrySnapshot);
      source.apps[this.app.id]!.releases['1.4.0'] = descriptor;
      source.revision = registryRevision(source) as `sha256:${string}`;
      this.respond(`${this.sourceRoot}/registry.json`, jsonResponse(source));
      this.respond(
        `${this.sourceRoot}/${this.sourceManifestPath}`,
        bytesResponse(mismatched, 'application/json'),
      );
    },
  };

  when = {
    deploy: async (): Promise<void> => {
      const args = new CliArguments([
        'deploy',
        this.app.id,
        '--to',
        this.environment,
        '--version',
        this.selector,
        '--registry-url',
        this.targetRoot,
        ...(this.sourceRegistry
          ? ['--source-registry-url', this.sourceRoot]
          : []),
        ...(this.dryRun ? ['--dry-run'] : []),
      ]);
      try {
        this.result = await new AtlasDeployService(args).run(this.app.id, {
          storage: this.storage,
        });
      } catch (error) {
        if (!(error instanceof AtlasDeploymentConvergenceError)) throw error;
        this.convergenceFailed = true;
        this.result = error.result;
      }
      this.results.push(this.result);
      this.desiredVersions.push(
        this.registry().deployments[this.environment]?.apps[this.app.id]
          ?.version,
      );
      this.activeAfterDeploy.push(
        this.storage.has(
          `environments/${this.environment}/hosts/${this.host.id}/manifest.json`,
        ),
      );
    },
    cleanup: (): void => {
      globalThis.fetch = this.originalFetch;
    },
  };

  get = {
    result: (): AtlasDeployResult | undefined => this.result,
    productionVersion: (): string =>
      this.registry().deployments.production!.apps[this.app.id]!.version,
    activeManifest: (): AtlasHostDeploymentManifest =>
      this.storage.json(
        `environments/${this.environment}/hosts/${this.host.id}/manifest.json`,
      ),
    activeEnvironments: (): string[] =>
      ['integration', 'production'].filter((environment) =>
        this.storage.has(
          `environments/${environment}/hosts/${this.host.id}/manifest.json`,
        ),
      ),
    appId: (): string => this.app.id,
    hostId: (): string => this.host.id,
    unrelatedHostId: (): string => this.unrelatedHost.id,
    crossRegistryTransfer: (): CrossRegistryTransfer => {
      const prefix = `apps/${this.app.id}/1.4.0`;
      const registry = this.registry();
      return {
        version: this.result?.version,
        manifestDigest: registry.apps[this.app.id]?.releases['1.4.0']?.digest,
        payloadDigest: digest(
          this.storage.required(`${prefix}/remoteEntry.json`),
        ),
        streamed: this.storage.wasStreamed(`${prefix}/remoteEntry.json`),
      };
    },
    expectedCrossRegistryTransfer: (): CrossRegistryTransfer => ({
      version: '1.4.0',
      manifestDigest: this.expectedManifestDigest,
      payloadDigest: digest(APP_ENTRY),
      streamed: true,
    }),
    convergence: (): Record<string, unknown> => ({
      firstPending: this.results[0]?.pendingHosts,
      firstFailed: this.convergenceFailed,
      desiredVersionAfterFirst: this.desiredVersions[0],
      activeAfterFirst: this.activeAfterDeploy[0],
      secondPending: this.results[1]?.pendingHosts,
      activeVersion: this.storage
        .json<AtlasHostDeploymentManifest>(
          `environments/${this.environment}/hosts/${this.host.id}/manifest.json`,
        )
        .apps[0]?.path.includes('/1.4.0/')
        ? '1.4.0'
        : undefined,
    }),
    mutationCount: (): number => this.storage.mutationCount(),
    unrelatedHostWasUpdated: (): boolean =>
      this.storage.has(
        `environments/${this.environment}/hosts/${this.unrelatedHost.id}/manifest.json`,
      ),
    convergedHostIds: (): string[] =>
      [...(this.result?.convergedHosts ?? [])].sort(),
    removedPlacementConvergence: (): {
      convergedHostIds: string[];
      activeAppCount: number;
    } => ({
      convergedHostIds: [...(this.result?.convergedHosts ?? [])].sort(),
      activeAppCount: this.getProjection().apps.length,
    }),
    projectionKinds: (): { apps: number; widgetProviders: number } => {
      const projection = this.getProjection();
      return {
        apps: projection.apps.length,
        widgetProviders: projection.widgetProviders?.length ?? 0,
      };
    },
  };

  private getProjection(): AtlasHostDeploymentManifest {
    return this.storage.json(
      `environments/${this.environment}/hosts/${this.host.id}/manifest.json`,
    );
  }

  private async seedRegistryWithHosts(
    app: AtlasAppArtifactManifest,
  ): Promise<void> {
    this.storage.clear();
    const hostDescriptor = await this.storeArtifact(this.host);
    const unrelatedDescriptor = await this.storeArtifact(this.unrelatedHost);
    const appDescriptor = await this.storeArtifact(app);
    let registry = publishArtifact(
      undefined,
      this.host,
      hostDescriptor,
    ).registry;
    registry = publishArtifact(
      registry,
      this.unrelatedHost,
      unrelatedDescriptor,
    ).registry;
    registry = publishArtifact(registry, app, appDescriptor).registry;
    for (const host of [this.host, this.unrelatedHost]) {
      registry = selectDeployment(
        registry,
        'production',
        resolveRelease(registry, host.id, '1.0.0'),
        {},
      ).registry;
    }
    await this.storage.seedJson('registry.json', registry, MUTABLE);
  }

  private respond(url: string, response: () => Response): void {
    this.responses.set(url, response);
  }

  private registry(): AtlasStaticRegistry {
    return this.storage.json('registry.json');
  }

  private async storeArtifact(
    manifest: AtlasPublishedArtifactManifest,
  ): Promise<ReturnType<typeof descriptorFor>> {
    const collection = manifest.kind === 'app-artifact' ? 'apps' : 'hosts';
    const version = manifest.release!.version;
    const prefix = `${collection}/${manifest.id}/${version}`;
    const payload = manifest.kind === 'app-artifact' ? APP_ENTRY : HOST_ENTRY;
    await this.storage.seed(`${prefix}/remoteEntry.json`, payload, {
      cacheControl: IMMUTABLE,
      contentType: 'application/json; charset=utf-8',
    });
    const bytes = manifestBytes(manifest);
    await this.storage.seed(`${prefix}/manifest.json`, bytes, {
      cacheControl: IMMUTABLE,
      contentType: 'application/json',
    });
    return descriptorFor(`${prefix}/manifest.json`, bytes);
  }
}

interface StoredObject {
  bytes: Uint8Array;
  metadata: AtlasPublicationObjectMetadata;
  version: string;
}

class MemoryDeployStorage implements AtlasPublicationStorage {
  private readonly objects = new Map<string, StoredObject>();
  private readonly streamedPaths = new Set<string>();
  private version = 0;
  private mutations = 0;
  private projectionFailures = 0;
  private createConflict?: {
    path: string;
    bytes: Uint8Array;
    metadata: AtlasPublicationObjectMetadata;
  };

  has(path: string): boolean {
    return this.objects.has(path);
  }

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
          versionToken: object.version,
        }
      : undefined;
  }

  async list(prefix: string): Promise<AtlasPublicationListedObject[]> {
    return [...this.objects]
      .filter(([path]) => path.startsWith(prefix))
      .map(([path, object]) => ({ path, size: object.bytes.byteLength }));
  }

  async create(
    path: string,
    body: AtlasPublicationBody,
    metadata: AtlasPublicationObjectMetadata,
  ): Promise<void> {
    if (this.objects.has(path)) throw new Error('object exists');
    if (this.createConflict?.path === path) {
      const conflict = this.createConflict;
      this.createConflict = undefined;
      await this.seed(path, conflict.bytes, conflict.metadata);
      throw new Error('conditional conflict');
    }
    this.mutations += 1;
    if (!(body instanceof Uint8Array)) this.streamedPaths.add(path);
    await this.seed(path, await collect(body), metadata);
  }

  async replace(
    path: string,
    body: AtlasPublicationBody,
    metadata: AtlasPublicationObjectMetadata,
    condition: AtlasPublicationReplaceCondition,
  ): Promise<void> {
    const current = this.objects.get(path);
    if (condition.createOnly && current)
      throw new Error('conditional conflict');
    if (condition.versionToken && current?.version !== condition.versionToken)
      throw new Error('conditional conflict');
    if (path.startsWith('environments/') && this.projectionFailures > 0) {
      this.projectionFailures -= 1;
      throw new Error('projection unavailable');
    }
    this.mutations += 1;
    await this.seed(path, await collect(body), metadata);
  }

  async remove(path: string): Promise<void> {
    this.mutations += 1;
    this.objects.delete(path);
  }

  async acquireLock(): Promise<AtlasPublicationLease> {
    return {
      assertHeld: async () => undefined,
      release: async () => undefined,
    };
  }

  async seed(
    path: string,
    bytes: Uint8Array,
    metadata: AtlasPublicationObjectMetadata,
  ): Promise<void> {
    this.version += 1;
    this.objects.set(path, { bytes, metadata, version: String(this.version) });
  }

  async seedJson(
    path: string,
    value: unknown,
    cacheControl: string,
  ): Promise<void> {
    await this.seed(
      path,
      new TextEncoder().encode(`${JSON.stringify(value)}\n`),
      {
        cacheControl,
        contentType: 'application/json',
      },
    );
  }

  json<T>(path: string): T {
    const object = this.objects.get(path);
    if (!object) throw new Error(`Missing ${path}`);
    return JSON.parse(new TextDecoder().decode(object.bytes)) as T;
  }

  clear(): void {
    this.objects.clear();
    this.streamedPaths.clear();
    this.version = 0;
    this.mutations = 0;
    this.projectionFailures = 0;
  }

  failNextProjectionWrites(count: number): void {
    this.projectionFailures = count;
  }

  conflictNextCreate(
    path: string,
    bytes: Uint8Array,
    metadata: AtlasPublicationObjectMetadata,
  ): void {
    this.createConflict = { path, bytes, metadata };
  }

  mutationCount(): number {
    return this.mutations;
  }

  required(path: string): Uint8Array {
    const object = this.objects.get(path);
    if (!object) throw new Error(`Missing ${path}`);
    return object.bytes;
  }

  wasStreamed(path: string): boolean {
    return this.streamedPaths.has(path);
  }
}

async function collect(body: AtlasPublicationBody): Promise<Uint8Array> {
  if (body instanceof Uint8Array) return body;
  const chunks: Uint8Array[] = [];
  for await (const chunk of body) chunks.push(chunk);
  const bytes = new Uint8Array(
    chunks.reduce((size, chunk) => size + chunk.byteLength, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

const APP_ENTRY = new TextEncoder().encode('{"name":"orders"}');
const HOST_ENTRY = new TextEncoder().encode('{"name":"shell"}');

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function jsonResponse(value: unknown): () => Response {
  const bytes = new TextEncoder().encode(`${JSON.stringify(value)}\n`);
  return bytesResponse(bytes, 'application/json');
}

function bytesResponse(bytes: Uint8Array, contentType: string): () => Response {
  return () =>
    new Response(responseBody(bytes), {
      headers: {
        'content-length': String(bytes.byteLength),
        'content-type': contentType,
      },
    });
}

function responseBody(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function streamedResponse(
  bytes: Uint8Array,
  contentType: string,
): () => Response {
  return () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          const middle = Math.ceil(bytes.byteLength / 2);
          controller.enqueue(bytes.slice(0, middle));
          controller.enqueue(bytes.slice(middle));
          controller.close();
        },
      }),
      {
        headers: {
          'content-length': String(bytes.byteLength),
          'content-type': contentType,
        },
      },
    );
}

function digest(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function file(bytes: Uint8Array) {
  return {
    path: 'remoteEntry.json',
    digest:
      `sha256:${createHash('sha256').update(bytes).digest('hex')}` as const,
    size: bytes.byteLength,
    mediaType: 'application/json; charset=utf-8',
    cacheControl: IMMUTABLE,
    role: 'remote-entry' as const,
  };
}

function appManifest(
  overrides: Partial<AtlasAppArtifactManifest> = {},
): AtlasAppArtifactManifest {
  const hostId = 'd145969d-8fe8-4b71-8aa4-8fb71fe54f63';
  return {
    schemaVersion: '2',
    kind: 'app-artifact',
    id: '5ab68dd4-f18c-4811-8768-b636ce559df6',
    name: 'orders',
    release: { version: '1.4.0' },
    framework: 'react',
    entryPath: 'remoteEntry.json',
    exposes: { entry: './entry' },
    files: [file(APP_ENTRY)],
    requiredHostSdkVersion: '^0.1.0',
    supportedHosts: [hostId],
    placements: [
      {
        id: 'orders-route',
        kind: 'route',
        hostId,
        route: { path: '/orders', title: 'Orders' },
      },
    ],
    ...overrides,
  };
}

function hostManifest(
  identity: { id: string; name: string } = {
    id: 'd145969d-8fe8-4b71-8aa4-8fb71fe54f63',
    name: 'shell',
  },
): AtlasHostArtifactManifest {
  return {
    schemaVersion: '2',
    kind: 'host-artifact',
    ...identity,
    release: { version: '1.0.0' },
    framework: 'react',
    entryPath: 'remoteEntry.json',
    exposes: { entry: './host' },
    files: [file(HOST_ENTRY)],
    requiredLoaderApiVersion: '^1.0.0',
  };
}
