import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import { jest } from '@jest/globals';
import type { AtlasLoaderDependencies } from '../atlas-loader.types.js';
import type { loadDeploymentCatalog as loadDeploymentCatalogType } from '../deployment-catalog/deployment-catalog.js';

const loadDeploymentCatalog = jest.fn<typeof loadDeploymentCatalogType>();
jest.unstable_mockModule('../deployment-catalog/deployment-catalog.js', () => ({
  loadDeploymentCatalog,
}));
const { loadStartupCatalog } = await import('./startup-catalog.js');
type StartupCatalog = Awaited<ReturnType<typeof loadStartupCatalog>>;

export class StartupCatalogDriver {
  private runtime!: AtlasHostRuntimeConfig;
  private session: unknown;
  private readonly fetchJson = jest.fn<
    (options: { url: string }) => Promise<unknown>
  >(async () => this.session);
  private result: StartupCatalog | undefined;
  private error: unknown;

  constructor() {
    loadDeploymentCatalog.mockReset();
  }

  readonly given = {
    runtime: (runtime: AtlasHostRuntimeConfig): StartupCatalogDriver => {
      this.runtime = runtime;

      return this;
    },
    deploymentCatalog: (catalog: AtlasHostCatalog): StartupCatalogDriver => {
      loadDeploymentCatalog.mockResolvedValue(catalog);

      return this;
    },
    developmentSession: (session: unknown): StartupCatalogDriver => {
      this.session = session;

      return this;
    },
  };

  readonly when = {
    loaded: async (): Promise<void> => {
      try {
        this.result = await loadStartupCatalog({
          runtime: this.runtime,
          dependencies: {
            fetchJson: this.fetchJson,
          } as unknown as AtlasLoaderDependencies,
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    result: (): StartupCatalog | undefined => this.result,
    error: (): unknown => this.error,
    fetchJsonMock: () => this.fetchJson,
    loadDeploymentCatalogMock: () => loadDeploymentCatalog,
  };
}
