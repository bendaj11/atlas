import type {
  AtlasHostDiscovery,
  AtlasHostCatalog,
  AtlasHostDeploymentManifest,
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
} from '@atlas/schema';
import type { AtlasBootstrapManifest } from '../bootstrap/bootstrap-manifest.js';
import { jest } from '@jest/globals';
import { faker } from '../test-utils/faker.js';
import type { HostModule } from '../types.js';
import {
  startAtlasLoader,
  type AtlasLoaderDependencies,
} from './atlas-loader.js';

export class AtlasLoaderDriver {
  private readonly root = {
    replaceChildren: jest.fn(),
  } as unknown as HTMLElement;
  private readonly runtime: AtlasHostRuntimeConfig = {
    schemaVersion: '1',
    hostId: faker.string.uuid(),
    environment: 'production',
    manifestUrl:
      'https://registry.example/environments/production/hosts/host/manifest.json',
    registryUrl: 'https://registry.example',
  };
  private readonly host = this.createHost();
  private readonly app = this.createApp();
  private readonly widgetProvider = this.createApp();
  private readonly catalog: AtlasHostCatalog = {
    schemaVersion: '1',
    hostId: this.runtime.hostId,
    revision: faker.git.commitSha(),
    generatedAt: faker.date.past().toISOString(),
    host: this.host,
    apps: [this.app],
  };
  private readonly fetchBytes =
    jest.fn<typeof import('../fetch-json/fetch-json.js').fetchBytes>();
  private readonly fetchJson = async <T>(url: string): Promise<T> => {
    if (url === '/atlas.bootstrap.json') return this.bootstrapManifest() as T;
    if (url.endsWith('/discovery.json')) return this.discovery() as T;
    return { catalog: this.catalog } as T;
  };
  private readonly installModuleShim = jest.fn(async () => undefined);
  private readonly loadHostModule = jest.fn(async (): Promise<HostModule> => ({
    mount: async (request) => {
      this.mountedCatalog = request.catalog;
    },
  }));
  private readonly loadPublishedArtifact = async (): Promise<
    AtlasManifest | AtlasHostManifest
  > => {
    const index = this.artifactIndex++;
    this.activeArtifactLoads += 1;
    this.maximumArtifactLoads = Math.max(
      this.maximumArtifactLoads,
      this.activeArtifactLoads,
    );
    await Promise.resolve();
    this.activeArtifactLoads -= 1;
    return this.nonHostArtifact
      ? this.app
      : ([this.host, this.app, this.widgetProvider][index] ?? this.app);
  };
  private readonly applyOverrides = jest.fn(
    async (_runtime: AtlasHostRuntimeConfig, catalog: AtlasHostCatalog) =>
      catalog,
  );
  private readonly validateCatalog = jest.fn();
  private readonly dependencies: AtlasLoaderDependencies = {
    document: { getElementById: jest.fn(() => this.root) },
    locationHref: 'https://host.example/orders',
    fetchBytes: this.fetchBytes,
    fetchJson: this.fetchJson,
    installModuleShim: this.installModuleShim,
    loadHostModule: this.loadHostModule,
    loadPublishedArtifact: this.loadPublishedArtifact,
    applyOverrides: this.applyOverrides,
    validateCatalog: this.validateCatalog,
  };
  private mountedCatalog: AtlasHostCatalog | undefined;
  private error: unknown;
  private deployment = this.createDeployment();
  private artifactIndex = 0;
  private nonHostArtifact = false;
  private activeArtifactLoads = 0;
  private maximumArtifactLoads = 0;

  constructor() {
    this.configureProductionRuntime();
  }

  readonly given = {
    developmentCatalog: (): AtlasLoaderDriver => {
      const developmentSessionUrl = faker.internet.url();
      Object.assign(this.runtime, { developmentSessionUrl });
      return this;
    },
    invalidDeployment: (): AtlasLoaderDriver => {
      this.deployment = {
        ...this.deployment,
        environment: faker.word.noun(),
      };
      this.configureProductionRuntime();
      return this;
    },
    deploymentWithNonHostArtifact: (): AtlasLoaderDriver => {
      this.nonHostArtifact = true;
      return this;
    },
    deploymentWithManyArtifacts: (): AtlasLoaderDriver => {
      this.deployment = {
        ...this.deployment,
        apps: Array.from({ length: 8 }, () => this.createDescriptor()),
        widgetProviders: [],
      };
      this.configureProductionRuntime();
      return this;
    },
  };

  readonly when = {
    start: async (): Promise<void> => {
      try {
        await startAtlasLoader(this.dependencies);
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    catalog: (): AtlasHostCatalog | undefined => this.mountedCatalog,
    error: (): unknown => this.error,
    productionCatalog: (): AtlasHostCatalog => ({
      schemaVersion: '1',
      hostId: this.runtime.hostId,
      revision: this.deployment.deploymentRevision,
      generatedAt: '1970-01-01T00:00:00.000Z',
      host: this.host,
      apps: [this.app],
      widgetProviders: [this.widgetProvider],
    }),
    developmentCatalog: (): AtlasHostCatalog => this.catalog,
    maximumArtifactLoads: (): number => this.maximumArtifactLoads,
  };

  private configureProductionRuntime(): void {
    this.fetchBytes.mockResolvedValue(
      new TextEncoder().encode(JSON.stringify(this.deployment)),
    );
    this.artifactIndex = 0;
  }

  private createDeployment(): AtlasHostDeploymentManifest {
    return {
      schemaVersion: '2',
      kind: 'host-deployment',
      hostId: this.runtime.hostId,
      environment: this.runtime.environment,
      deploymentRevision: `sha256:${faker.string
        .hexadecimal({
          length: 64,
          prefix: '',
        })
        .toLowerCase()}`,
      host: this.createDescriptor(),
      apps: [this.createDescriptor()],
      widgetProviders: [this.createDescriptor()],
    };
  }

  private bootstrapManifest(): AtlasBootstrapManifest {
    return {
      schemaVersion: '2',
      hostId: this.runtime.hostId,
      registryUrl: this.runtime.registryUrl!,
      resourcesTimeoutMs: 15000,
      resourcesRetryCount: 3,
      ...(this.runtime.developmentSessionUrl
        ? { developmentRuntime: this.runtime }
        : {}),
    };
  }

  private discovery(): AtlasHostDiscovery {
    return {
      schemaVersion: '1',
      hostId: this.runtime.hostId,
      bindings: [
        {
          baseUrl: 'https://host.example',
          environment: this.runtime.environment,
          manifestUrl: this.runtime.manifestUrl,
        },
      ],
    };
  }

  private createDescriptor(): AtlasHostDeploymentManifest['host'] {
    return {
      ...this.createDescriptorBase(),
      url: faker.internet.url(),
    };
  }

  private createDescriptorBase(): {
    path: string;
    digest: `sha256:${string}`;
    size: number;
    mediaType: 'application/json';
  } {
    return {
      path: faker.system.fileName(),
      digest: `sha256:${faker.string
        .hexadecimal({ length: 64, prefix: '' })
        .toLowerCase()}`,
      size: faker.number.int({ min: 1 }),
      mediaType: 'application/json',
    };
  }

  private createHost(): AtlasHostManifest {
    return {
      schemaVersion: '1',
      kind: 'host',
      id: this.runtime.hostId,
      name: faker.company.name(),
      version: faker.system.semver(),
      buildId: faker.string.uuid(),
      channel: faker.custom.channel(),
      framework: faker.custom.framework(),
      remoteEntryUrl: faker.internet.url(),
      exposes: { entry: './host' },
      requiredLoaderApiVersion: '^1.0.0',
      createdAt: faker.date.past().toISOString(),
    };
  }

  private createApp(): AtlasManifest {
    return {
      schemaVersion: '1',
      kind: 'app',
      id: faker.string.uuid(),
      name: faker.company.name(),
      version: faker.system.semver(),
      buildId: faker.string.uuid(),
      channel: faker.custom.channel(),
      framework: faker.custom.framework(),
      remoteEntryUrl: faker.internet.url(),
      exposes: { entry: './app' },
      requiredHostSdkVersion: '^1.0.0',
      supportedHosts: [this.runtime.hostId],
      placements: [],
      createdAt: faker.date.past().toISOString(),
    };
  }
}
