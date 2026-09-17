import type {
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
  AtlasManifestDescriptor,
} from '@atlas/schema';
import { jest } from '@jest/globals';
import {
  loadPublishedArtifact,
  type PublishedArtifactDependencies,
} from './index.js';

export class PublishedArtifactDriver {
  private readonly fetchBytes =
    jest.fn<PublishedArtifactDependencies['fetchBytes']>();
  private readonly hydratePublishedArtifactManifest =
    jest.fn<
      PublishedArtifactDependencies['hydratePublishedArtifactManifest']
    >();
  private reference!: AtlasManifestDescriptor;
  private runtime!: AtlasHostRuntimeConfig;
  private result: AtlasManifest | AtlasHostManifest | undefined;
  private error: unknown;

  readonly given = {
    runtime: (runtime: AtlasHostRuntimeConfig): PublishedArtifactDriver => {
      this.runtime = runtime;

      return this;
    },
    reference: (
      reference: AtlasManifestDescriptor,
    ): PublishedArtifactDriver => {
      this.reference = reference;

      return this;
    },
    fetchedBytes: (bytes: Uint8Array): PublishedArtifactDriver => {
      this.fetchBytes.mockResolvedValue(bytes);

      return this;
    },
    hydratedManifest: (
      manifest: AtlasManifest | AtlasHostManifest,
    ): PublishedArtifactDriver => {
      this.hydratePublishedArtifactManifest.mockReturnValue(manifest);

      return this;
    },
  };

  readonly when = {
    loaded: async (): Promise<void> => {
      try {
        this.result = await loadPublishedArtifact({
          reference: this.reference,
          runtime: this.runtime,
          dependencies: {
            fetchBytes: this.fetchBytes,
            hydratePublishedArtifactManifest:
              this.hydratePublishedArtifactManifest,
          },
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    result: (): AtlasManifest | AtlasHostManifest | undefined => this.result,
    error: (): unknown => this.error,
    fetchBytesMock: () => this.fetchBytes,
    hydrateMock: () => this.hydratePublishedArtifactManifest,
  };
}
