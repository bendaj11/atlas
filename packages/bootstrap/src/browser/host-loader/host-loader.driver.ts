import type { AtlasHostManifest, AtlasHostRuntimeConfig } from '@atlas/schema';
import { jest } from '@jest/globals';
import type { fetchJson } from '../fetch-json/index.js';
import type { HostModule } from '../host-module.js';
import type { importModule } from '../module-shim/index.js';
import type {
  validateArtifactUrl,
  validateHostManifest,
} from '../validation/index.js';
import type { watchHostBuildNotifications as watchHostBuildNotificationsType } from './build-notifications/build-notifications.js';
import type {
  HostLoaderDocument,
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
const { loadHostModule } = await import('./host-loader.js');

export class HostLoaderDriver {
  private manifest!: AtlasHostManifest;
  private runtime!: AtlasHostRuntimeConfig;
  private readonly fetchJson =
    jest.fn<(options: unknown) => Promise<unknown>>();
  private readonly importModule = jest.fn<typeof importModule>();
  private readonly validateArtifactUrl = jest.fn<typeof validateArtifactUrl>();
  private readonly validateHostManifest =
    jest.fn<typeof validateHostManifest>();
  private module: HostModule | undefined;
  private error: unknown;

  constructor() {
    watchHostBuildNotifications.mockReset();
    loadHostStyles.mockReset();
    installHostSharedDependencies.mockReset();
  }

  readonly given = {
    manifest: (manifest: AtlasHostManifest): HostLoaderDriver => {
      this.manifest = manifest;

      return this;
    },
    runtime: (runtime: AtlasHostRuntimeConfig): HostLoaderDriver => {
      this.runtime = runtime;

      return this;
    },
    remoteMetadata: (metadata: RemoteMetadata): HostLoaderDriver => {
      this.fetchJson.mockResolvedValue(metadata);

      return this;
    },
    importedModule: (module: HostModule): HostLoaderDriver => {
      this.importModule.mockResolvedValue(module);

      return this;
    },
  };

  readonly when = {
    loaded: async (): Promise<void> => {
      try {
        this.module = await loadHostModule({
          manifest: this.manifest,
          runtime: this.runtime,
          dependencies: {
            document: {} as HostLoaderDocument,
            fetchJson: this.fetchJson as typeof fetchJson,
            importModule: this.importModule,
            validateArtifactUrl: this.validateArtifactUrl,
            validateHostManifest: this.validateHostManifest,
            reloadPage: () => undefined,
          },
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    module: (): HostModule | undefined => this.module,
    error: (): unknown => this.error,
    fetchJsonMock: () => this.fetchJson,
    importModuleMock: () => this.importModule,
    validateArtifactUrlMock: () => this.validateArtifactUrl,
    validateHostManifestMock: () => this.validateHostManifest,
    watchHostBuildNotificationsMock: () => watchHostBuildNotifications,
    loadHostStylesMock: () => loadHostStyles,
    installHostSharedDependenciesMock: () => installHostSharedDependencies,
  };
}
