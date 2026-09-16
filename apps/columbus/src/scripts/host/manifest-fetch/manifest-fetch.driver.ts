import { jest } from '@jest/globals';
import type { ArtifactVersion } from '../../../types/contracts';
import { anAppArtifactVersion } from '../../../types/app.testkit';
import { aPublishedArtifact } from '../registry.testkit';
import {
  fetchVerifiedManifest,
  fetchWithTimeout,
  type ManifestDescriptor,
  manifestReference,
} from './manifest-fetch';

export class ManifestFetchDriver {
  private readonly fetch = jest.fn<typeof globalThis.fetch>();
  private readonly published = aPublishedArtifact(
    anAppArtifactVersion({
      id: 'orders',
      channel: 'production',
      version: '1.0.0',
    }),
  );
  private descriptor: ManifestDescriptor = this.published.descriptor;
  private result: ArtifactVersion | undefined;
  private response: Response | undefined;
  private error: unknown;

  constructor() {
    globalThis.fetch = this.fetch;
    this.fetch.mockResolvedValue(
      new Response(new Uint8Array(this.published.bytes), { status: 200 }),
    );
  }

  readonly given = {
    descriptor: (descriptor: Partial<ManifestDescriptor>): this => {
      this.descriptor = { ...this.descriptor, ...descriptor };

      return this;
    },
    responseStatus: (status: number): this => {
      this.fetch.mockResolvedValue(new Response(null, { status }));

      return this;
    },
  };

  readonly when = {
    manifestFetched: async (): Promise<void> => {
      try {
        this.result = await fetchVerifiedManifest(
          manifestReference('https://registry.example', this.descriptor),
        );
      } catch (error) {
        this.error = error;
      }
    },
    fetchedWithTimeout: async (
      input: string,
      cache?: RequestCache,
    ): Promise<void> => {
      this.response = await fetchWithTimeout(input, cache);
    },
  };

  readonly get = {
    manifestId: (): string | undefined => this.result?.id,
    errorMessage: (): string | undefined =>
      this.error instanceof Error ? this.error.message : undefined,
    requestedUrl: (): unknown => this.fetch.mock.calls[0]?.[0],
    requestInit: (): RequestInit | undefined => this.fetch.mock.calls[0]?.[1],
    responseStatus: (): number | undefined => this.response?.status,
  };
}
