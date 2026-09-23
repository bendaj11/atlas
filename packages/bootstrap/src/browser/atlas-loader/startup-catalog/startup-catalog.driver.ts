import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import type { DevSession } from '../../overrides/index.js';
import { jest } from '@jest/globals';
import type { FetchOptions, fetchBytes } from '../../fetch-json/index.js';
import type { loadPublishedArtifact } from '../../published-artifact/index.js';
import type { loadDeploymentCatalog as loadDeploymentCatalogType } from '../deployment-catalog/deployment-catalog.js';

const loadDeploymentCatalog = jest.fn<typeof loadDeploymentCatalogType>();
jest.unstable_mockModule('../deployment-catalog/deployment-catalog.js', () => ({
  loadDeploymentCatalog,
}));
const { loadStartupCatalog } = await import('./startup-catalog.js');
type StartupCatalog = Awaited<ReturnType<typeof loadStartupCatalog>>;

export class StartupCatalogDriver {
  private runtime!: AtlasHostRuntimeConfig;
  private readonly fetchJson =
    jest.fn<(options: FetchOptions) => Promise<DevSession>>();
  private readonly fetchBytes = jest.fn<typeof fetchBytes>();
  private readonly loadPublishedArtifact =
    jest.fn<typeof loadPublishedArtifact>();
  private result: StartupCatalog | undefined;
  private error: unknown;

  constructor() {
    loadDeploymentCatalog.mockReset();
  }

  readonly given = {
    runtime: (runtime: AtlasHostRuntimeConfig) => {
      this.runtime = runtime;

      return this;
    },
    deploymentCatalog: (catalog: AtlasHostCatalog) => {
      loadDeploymentCatalog.mockResolvedValue(catalog);

      return this;
    },
    developmentSession: (session: DevSession) => {
      this.fetchJson.mockResolvedValue(session);

      return this;
    },
  };

  readonly when = {
    loaded: async () => {
      try {
        this.result = await loadStartupCatalog({
          runtime: this.runtime,
          dependencies: {
            fetchJson: this.fetchJson,
            fetchBytes: this.fetchBytes,
            loadPublishedArtifact: this.loadPublishedArtifact,
          },
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    result: () => this.result,
    error: () => this.error,
    fetchJsonMock: () => this.fetchJson,
    loadDeploymentCatalogMock: () => loadDeploymentCatalog,
  };
}
