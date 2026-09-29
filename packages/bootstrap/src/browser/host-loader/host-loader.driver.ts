import type { AtlasHostManifest, AtlasHostRuntimeConfig } from '@atlas/schema';
import { jest } from '@jest/globals';
import type { FetchOptions } from '../fetch-json/index.js';
import type { HostModule } from '../host-module.js';
import type { importModule } from '../module-shim/index.js';
import type {
  validateArtifactUrl,
  validateHostManifest,
} from '../validation/index.js';
import type { watchHostBuildNotifications as watchHostBuildNotificationsType } from './build-notifications/build-notifications.js';
import type {
  HostLoaderDocument,
  PrefetchedHostRemoteEntry,
  RemoteMetadata,
} from './host-loader.types.js';
import type { loadHostStyles as loadHostStylesType } from './host-styles/host-styles.js';
import type { installHostSharedDependencies as installHostSharedDependenciesType } from './shared-dependencies/shared-dependencies.js';

const watchHostBuildNotifications =
  jest.fn<typeof watchHostBuildNotificationsType>();
const loadHostStyles = jest.fn<typeof loadHostStylesType>();
const installHostSharedDependencies =
  jest.fn<typeof installHostSharedDependenciesType>();
jest.unstable_mockModule(
  './build-notifications/build-notifications.js',
  () => ({
    watchHostBuildNotifications,
  }),
);
jest.unstable_mockModule('./host-styles/host-styles.js', () => ({
  loadHostStyles,
}));
jest.unstable_mockModule(
  './shared-dependencies/shared-dependencies.js',
  () => ({
    installHostSharedDependencies,
  }),
);
const { loadHostModule, prefetchHostRemoteEntry } =
  await import('./host-loader.js');

export class HostLoaderDriver {
  private manifest!: AtlasHostManifest;
  private runtime!: AtlasHostRuntimeConfig;
  private readonly fetchJson =
    jest.fn<(options: FetchOptions) => Promise<RemoteMetadata>>();
  private readonly importModule = jest.fn<typeof importModule>();
  private readonly validateArtifactUrl = jest.fn<typeof validateArtifactUrl>();
  private readonly validateHostManifest =
    jest.fn<typeof validateHostManifest>();
  private readonly removeHostStyles = jest.fn<() => void>();
  private readonly removeSharedDependencies = jest.fn<() => void>();
  private module: HostModule | undefined;
  private error: unknown;
  private prefetchedRemoteEntry: PrefetchedHostRemoteEntry | undefined;

  constructor() {
    watchHostBuildNotifications.mockReset();
    loadHostStyles.mockReset();
    installHostSharedDependencies.mockReset();
    loadHostStyles.mockReturnValue(this.removeHostStyles);
    installHostSharedDependencies.mockReturnValue(
      this.removeSharedDependencies,
    );
  }

  readonly given = {
    manifest: (manifest: AtlasHostManifest) => {
      this.manifest = manifest;

      return this;
    },
    runtime: (runtime: AtlasHostRuntimeConfig) => {
      this.runtime = runtime;

      return this;
    },
    remoteMetadata: (metadata: RemoteMetadata) => {
      this.fetchJson.mockResolvedValue(metadata);

      return this;
    },
    importedModule: (module: HostModule) => {
      this.importModule.mockResolvedValue(module);

      return this;
    },
    prefetchedRemoteEntry: (entry: PrefetchedHostRemoteEntry) => {
      this.prefetchedRemoteEntry = entry;

      return this;
    },
    hostManifestRejection: (error: Error) => {
      this.validateHostManifest.mockImplementation(() => {
        throw error;
      });

      return this;
    },
  };

  readonly when = {
    loaded: async () => {
      try {
        this.module = await loadHostModule({
          manifest: this.manifest,
          runtime: this.runtime,
          ...(this.prefetchedRemoteEntry
            ? { prefetchedRemoteEntry: this.prefetchedRemoteEntry }
            : {}),
          dependencies: this.dependencies(),
        });
      } catch (error) {
        this.error = error;
      }
    },
    prefetched: () => {
      this.prefetchedRemoteEntry = prefetchHostRemoteEntry({
        manifest: this.manifest,
        runtime: this.runtime,
        dependencies: this.dependencies(),
      });
    },
  };

  readonly get = {
    module: () => this.module,
    error: () => this.error,
    prefetchedRemoteEntry: () => this.prefetchedRemoteEntry,
    fetchJsonMock: () => this.fetchJson,
    remoteEntryVerification: () => this.fetchJson.mock.calls[0]?.[0].verify,
    importModuleMock: () => this.importModule,
    validateArtifactUrlMock: () => this.validateArtifactUrl,
    validateHostManifestMock: () => this.validateHostManifest,
    watchHostBuildNotificationsMock: () => watchHostBuildNotifications,
    loadHostStylesMock: () => loadHostStyles,
    removeHostStylesMock: () => this.removeHostStyles,
    installHostSharedDependenciesMock: () => installHostSharedDependencies,
  };

  private dependencies() {
    return {
      document: {} as HostLoaderDocument,
      fetchJson: this.fetchJson,
      importModule: this.importModule,
      validateArtifactUrl: this.validateArtifactUrl,
      validateHostManifest: this.validateHostManifest,
      reloadPage: () => undefined,
    };
  }
}
