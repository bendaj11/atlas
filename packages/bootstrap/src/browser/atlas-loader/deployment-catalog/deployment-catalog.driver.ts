import type {
  AtlasHostCatalog,
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
  AtlasManifestDescriptor,
} from '@atlas/schema';
import { jest } from '@jest/globals';
import type { AtlasLoaderDependencies } from '../atlas-loader.types.js';
import type { fetchBytes } from '../../fetch-json/index.js';
import type { loadPublishedArtifact } from '../../published-artifact/index.js';
import { loadDeploymentCatalog } from './deployment-catalog.js';

export class DeploymentCatalogDriver {
  private runtime!: AtlasHostRuntimeConfig;
  private deployment: unknown;
  private readonly artifacts = new Map<
    string,
    AtlasManifest | AtlasHostManifest
  >();
  private activeArtifactLoads = 0;
  private maximumArtifactLoads = 0;
  private readonly fetchBytes = jest.fn<typeof fetchBytes>(async () =>
    new TextEncoder().encode(JSON.stringify(this.deployment)),
  );
  private readonly loadPublishedArtifact = jest.fn<
    typeof loadPublishedArtifact
  >(async ({ reference }) => {
    this.activeArtifactLoads += 1;
    this.maximumArtifactLoads = Math.max(
      this.maximumArtifactLoads,
      this.activeArtifactLoads,
    );
    await Promise.resolve();
    this.activeArtifactLoads -= 1;

    return this.artifacts.get(reference.path)!;
  });
  private catalog: AtlasHostCatalog | undefined;
  private error: unknown;

  readonly given = {
    runtime: (runtime: AtlasHostRuntimeConfig): DeploymentCatalogDriver => {
      this.runtime = runtime;

      return this;
    },
    deployment: (deployment: unknown): DeploymentCatalogDriver => {
      this.deployment = deployment;

      return this;
    },
    publishedArtifact: (
      reference: AtlasManifestDescriptor,
      manifest: AtlasManifest | AtlasHostManifest,
    ): DeploymentCatalogDriver => {
      this.artifacts.set(reference.path, manifest);

      return this;
    },
  };

  readonly when = {
    loaded: async (): Promise<void> => {
      try {
        this.catalog = await loadDeploymentCatalog({
          runtime: this.runtime,
          dependencies: {
            fetchBytes: this.fetchBytes,
            loadPublishedArtifact: this.loadPublishedArtifact,
          } as unknown as AtlasLoaderDependencies,
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    catalog: (): AtlasHostCatalog | undefined => this.catalog,
    error: (): unknown => this.error,
    maximumArtifactLoads: (): number => this.maximumArtifactLoads,
    fetchBytesMock: () => this.fetchBytes,
    loadPublishedArtifactMock: () => this.loadPublishedArtifact,
  };
}
