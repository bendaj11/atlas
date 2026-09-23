import { jest } from '@jest/globals';
import type { ArtifactVersion } from '../../../types/artifact-version';
import type * as ManifestFetchModule from '../manifest-fetch/manifest-fetch';

const manifestFetch = await import('../manifest-fetch/manifest-fetch');
const fetchWithTimeout = jest.fn<typeof ManifestFetchModule.fetchWithTimeout>();
const fetchVerifiedManifest =
  jest.fn<typeof ManifestFetchModule.fetchVerifiedManifest>();

jest.unstable_mockModule('../manifest-fetch/manifest-fetch', () => ({
  ...manifestFetch,
  fetchWithTimeout,
  fetchVerifiedManifest,
}));

export class ArtifactRegistryDriver {
  constructor() {
    jest.clearAllMocks();
  }

  readonly given = {
    registryResponse: (response: Response) => {
      fetchWithTimeout.mockResolvedValue(response);

      return this;
    },
    manifest: (manifest: ArtifactVersion) => {
      fetchVerifiedManifest.mockResolvedValueOnce(manifest);

      return this;
    },
    manifestFailure: (error: Error) => {
      fetchVerifiedManifest.mockRejectedValueOnce(error);

      return this;
    },
  };

  readonly get = {
    fetchWithTimeout: () => fetchWithTimeout,
    fetchVerifiedManifest: () => fetchVerifiedManifest,
  };
}
