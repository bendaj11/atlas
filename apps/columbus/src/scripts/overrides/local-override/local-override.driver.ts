import { jest } from '@jest/globals';
import type { ArtifactVersion } from '../../../types/contracts';
import { anAppArtifactVersion } from '../../../types/app.testkit';
import { validateLocalOverride } from './local-override';

export class LocalOverrideDriver {
  private manifest: ArtifactVersion = anAppArtifactVersion({
    channel: 'local',
    remoteEntryUrl: 'http://localhost:4513/remoteEntry.json',
    exposes: { entry: './entry' },
  });
  private readonly fetch = jest.fn<typeof globalThis.fetch>();
  private error: unknown;

  constructor() {
    globalThis.fetch = this.fetch;
  }

  readonly given = {
    manifest: (manifest: ArtifactVersion): this => {
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
    validated: async (): Promise<void> => {
      try {
        await validateLocalOverride(this.manifest);
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    errorMessage: (): string | undefined =>
      this.error instanceof Error ? this.error.message : undefined,
    fetchCount: (): number => this.fetch.mock.calls.length,
    fetchedUrl: (): unknown => this.fetch.mock.calls[0]?.[0],
  };
}
