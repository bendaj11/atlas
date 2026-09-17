import type {
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
  AtlasStaticRegistry,
} from '@atlas/schema';
import { jest } from '@jest/globals';
import type { fetchJson } from '../../fetch-json/index.js';
import type { OverridesDependencies } from '../overrides.types.js';
import type { loadPublishedArtifact } from '../../published-artifact/index.js';
import { resolveOverrideManifest } from './resolve-override-manifest.js';

export class ResolveOverrideManifestDriver {
  private runtime!: AtlasHostRuntimeConfig;
  private readonly fetchJson =
    jest.fn<(options: unknown) => Promise<unknown>>();
  private readonly loadPublishedArtifact =
    jest.fn<typeof loadPublishedArtifact>();
  private result: AtlasHostManifest | AtlasManifest | undefined;
  private error: unknown;

  readonly given = {
    runtime: (
      runtime: AtlasHostRuntimeConfig,
    ): ResolveOverrideManifestDriver => {
      this.runtime = runtime;

      return this;
    },
    registry: (
      registry: AtlasStaticRegistry,
    ): ResolveOverrideManifestDriver => {
      this.fetchJson.mockResolvedValue(registry);

      return this;
    },
    registryFailure: (error: Error): ResolveOverrideManifestDriver => {
      this.fetchJson.mockRejectedValue(error);

      return this;
    },
    publishedArtifact: (
      manifest: AtlasHostManifest | AtlasManifest,
    ): ResolveOverrideManifestDriver => {
      this.loadPublishedArtifact.mockResolvedValue(manifest);

      return this;
    },
    publishedArtifactFailure: (error: Error): ResolveOverrideManifestDriver => {
      this.loadPublishedArtifact.mockRejectedValue(error);

      return this;
    },
  };

  readonly when = {
    resolved: async (
      manifest: AtlasHostManifest | AtlasManifest,
    ): Promise<void> => {
      try {
        this.result = await resolveOverrideManifest({
          manifest,
          runtime: this.runtime,
          dependencies: {
            fetchJson: this.fetchJson as typeof fetchJson,
            loadPublishedArtifact: this.loadPublishedArtifact,
          } as unknown as OverridesDependencies,
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    result: (): AtlasHostManifest | AtlasManifest | undefined => this.result,
    error: (): unknown => this.error,
    fetchJsonMock: () => this.fetchJson,
    loadPublishedArtifactMock: () => this.loadPublishedArtifact,
  };
}
