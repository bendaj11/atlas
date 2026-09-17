import type {
  AtlasHostCatalog,
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
} from '@atlas/schema';
import { jest } from '@jest/globals';
import type { fetchBytes } from '../../fetch-json/index.js';
import type { loadPublishedArtifact } from '../../published-artifact/index.js';
import { loadDeploymentCatalog } from './deployment-catalog.js';

type PublishedManifest = AtlasManifest | AtlasHostManifest;

export class DeploymentCatalogDriver {
  private runtime!: AtlasHostRuntimeConfig;
  private readonly fetchBytes = jest.fn<typeof fetchBytes>();
  private readonly loadPublishedArtifact =
    jest.fn<typeof loadPublishedArtifact>();
  private catalog: AtlasHostCatalog | undefined;
  private error: unknown;

  readonly given = {
    runtime: (runtime: AtlasHostRuntimeConfig): DeploymentCatalogDriver => {
      this.runtime = runtime;

      return this;
    },
    deployment: (deployment: unknown): DeploymentCatalogDriver => {
      this.fetchBytes.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(deployment)),
      );

      return this;
    },
    publishedArtifact: (
      manifest: PublishedManifest,
    ): DeploymentCatalogDriver => {
      this.loadPublishedArtifact.mockResolvedValueOnce(manifest);

      return this;
    },
    publishedArtifactLoad: (
      load: Promise<PublishedManifest>,
    ): DeploymentCatalogDriver => {
      this.loadPublishedArtifact.mockReturnValue(load);

      return this;
    },
  };

  readonly when = {
    loaded: async (): Promise<void> => {
      try {
        this.catalog = await this.load();
      } catch (error) {
        this.error = error;
      }
    },
    loadStarted: async (): Promise<void> => {
      void this.load().catch(() => undefined);

      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  };

  readonly get = {
    catalog: (): AtlasHostCatalog | undefined => this.catalog,
    error: (): unknown => this.error,
    fetchBytesMock: () => this.fetchBytes,
    loadPublishedArtifactMock: () => this.loadPublishedArtifact,
  };

  private load(): Promise<AtlasHostCatalog> {
    return loadDeploymentCatalog({
      runtime: this.runtime,
      dependencies: {
        fetchBytes: this.fetchBytes,
        loadPublishedArtifact: this.loadPublishedArtifact,
      },
    });
  }
}
