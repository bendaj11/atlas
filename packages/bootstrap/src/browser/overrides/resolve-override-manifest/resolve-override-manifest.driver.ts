import type {
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
  AtlasStaticRegistry,
} from '@atlas/schema';
import { jest } from '@jest/globals';
import type { FetchOptions } from '../../fetch-json/index.js';
import type { loadPublishedArtifact } from '../../published-artifact/index.js';
import { resolveOverrideManifest } from './resolve-override-manifest.js';

export class ResolveOverrideManifestDriver {
  private runtime!: AtlasHostRuntimeConfig;
  private readonly fetchJson =
    jest.fn<(options: FetchOptions) => Promise<AtlasStaticRegistry>>();
  private readonly loadPublishedArtifact =
    jest.fn<typeof loadPublishedArtifact>();
  private result: AtlasHostManifest | AtlasManifest | undefined;
  private error: unknown;

  readonly given = {
    runtime: (runtime: AtlasHostRuntimeConfig) => {
      this.runtime = runtime;

      return this;
    },
    registry: (registry: AtlasStaticRegistry) => {
      this.fetchJson.mockResolvedValue(registry);

      return this;
    },
    registryFailure: (error: Error) => {
      this.fetchJson.mockRejectedValue(error);

      return this;
    },
    publishedArtifact: (manifest: AtlasHostManifest | AtlasManifest) => {
      this.loadPublishedArtifact.mockResolvedValue(manifest);

      return this;
    },
    publishedArtifactFailure: (error: Error) => {
      this.loadPublishedArtifact.mockRejectedValue(error);

      return this;
    },
  };

  readonly when = {
    resolved: async (manifest: AtlasHostManifest | AtlasManifest) => {
      try {
        this.result = await resolveOverrideManifest({
          manifest,
          runtime: this.runtime,
          dependencies: {
            fetchJson: this.fetchJson,
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
    loadPublishedArtifactMock: () => this.loadPublishedArtifact,
  };
}
