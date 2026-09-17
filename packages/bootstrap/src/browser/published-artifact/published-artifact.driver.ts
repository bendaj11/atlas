import type {
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
  AtlasManifestDescriptor,
  hydratePublishedArtifactManifest,
} from '@atlas/schema';
import { jest } from '@jest/globals';
import type { assertBytesMatchDescriptor as assertBytesMatchDescriptorType } from './assert-bytes-match-descriptor/assert-bytes-match-descriptor.js';
import type { fetchBytes } from '../fetch-json/index.js';

const assertBytesMatchDescriptor =
  jest.fn<typeof assertBytesMatchDescriptorType>();
jest.unstable_mockModule(
  './assert-bytes-match-descriptor/assert-bytes-match-descriptor.js',
  () => ({
    assertBytesMatchDescriptor,
  }),
);
const { loadPublishedArtifact } = await import('./index.js');

export class PublishedArtifactDriver {
  private readonly fetchBytes = jest.fn<typeof fetchBytes>();
  private readonly hydratePublishedArtifactManifest =
    jest.fn<typeof hydratePublishedArtifactManifest>();
  private reference!: AtlasManifestDescriptor;
  private runtime!: AtlasHostRuntimeConfig;
  private result: AtlasManifest | AtlasHostManifest | undefined;
  private error: unknown;

  constructor() {
    assertBytesMatchDescriptor.mockReset();
    assertBytesMatchDescriptor.mockResolvedValue(undefined);
  }

  readonly given = {
    runtime: (runtime: AtlasHostRuntimeConfig) => {
      this.runtime = runtime;

      return this;
    },
    reference: (reference: AtlasManifestDescriptor) => {
      this.reference = reference;

      return this;
    },
    descriptorFailure: (error: Error) => {
      assertBytesMatchDescriptor.mockRejectedValue(error);

      return this;
    },
    fetchedBytes: (bytes: Uint8Array) => {
      this.fetchBytes.mockResolvedValue(bytes);

      return this;
    },
    hydratedManifest: (manifest: AtlasManifest | AtlasHostManifest) => {
      this.hydratePublishedArtifactManifest.mockReturnValue(manifest);

      return this;
    },
  };

  readonly when = {
    loaded: async () => {
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
    result: () => this.result,
    error: () => this.error,
    fetchBytesMock: () => this.fetchBytes,
    assertBytesMatchDescriptorMock: () => assertBytesMatchDescriptor,
    hydrateMock: () => this.hydratePublishedArtifactManifest,
  };
}
