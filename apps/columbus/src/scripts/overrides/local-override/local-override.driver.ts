import { jest } from '@jest/globals';
import type { AtlasExtensionManifest as Manifest } from '../../../types/contracts';
import { aManifest } from '../../../types/app.testkit';
import { validateLocalOverride } from './local-override';

export class LocalOverrideDriver {
  private manifest: Manifest = aManifest({
    channel: 'local',
    remoteEntryUrl: 'http://localhost:4513/remoteEntry.json',
  });
  private readonly fetch = jest.fn<typeof globalThis.fetch>();
  private error: unknown;

  constructor() {
    globalThis.fetch = this.fetch;
  }

  readonly given = {
    manifest: (manifest: Manifest): this => {
      this.manifest = manifest;

      return this;
    },
    remoteEntry: (metadata: unknown): this => {
      this.fetch.mockResolvedValue(Response.json(metadata));

      return this;
    },
    remoteEntryStatus: (status: number): this => {
      this.fetch.mockResolvedValue(new Response(null, { status }));

      return this;
    },
    unreachableRemoteEntry: (): this => {
      this.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

      return this;
    },
  };

  readonly when = {
    validated: async (): Promise<this> => {
      try {
        await validateLocalOverride(this.manifest);
      } catch (error) {
        this.error = error;
      }

      return this;
    },
  };

  readonly get = {
    errorMessage: (): string | undefined =>
      this.error instanceof Error ? this.error.message : undefined,
    fetchCount: (): number => this.fetch.mock.calls.length,
    fetchedUrl: (): unknown => this.fetch.mock.calls[0]?.[0],
  };
}
