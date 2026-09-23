import { jest } from '@jest/globals';
import type { ArtifactVersion } from '../../types/artifact-version';
import type * as ManifestFetchModule from '../manifest-fetch/manifest-fetch';

const manifestFetch = await import('../manifest-fetch/manifest-fetch');
const fetchWithTimeout =
  jest.fn<
    (
      ...parameters: Parameters<typeof ManifestFetchModule.fetchWithTimeout>
    ) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>
  >();

jest.unstable_mockModule('../manifest-fetch/manifest-fetch', () => ({
  ...manifestFetch,
  fetchWithTimeout,
}));

export class HostCatalogDriver {
  private readonly loadManifest =
    jest.fn<
      (
        reference: ManifestFetchModule.ManifestReference,
      ) => Promise<ArtifactVersion>
    >();

  constructor() {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  }

  readonly given = {
    pageLocation: (href: string) => {
      Object.defineProperty(globalThis, 'location', {
        value: { href },
        configurable: true,
      });

      return this;
    },
    fetchJson: (body: unknown) => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => body,
      });

      return this;
    },
    fetchStatus: (status: number) => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        status,
        json: async () => null,
      });

      return this;
    },
    manifest: (manifest: ArtifactVersion) => {
      this.loadManifest.mockResolvedValueOnce(manifest);

      return this;
    },
    runtimeSnapshot: (snapshot: unknown) => {
      const script = document.createElement('script');
      script.id = 'atlas-runtime-snapshot';
      script.type = 'application/json';
      script.textContent = JSON.stringify(snapshot);
      document.body.append(script);

      return this;
    },
  };

  readonly get = {
    fetchWithTimeout: () => fetchWithTimeout,
    loadManifest: () => this.loadManifest,
  };
}
