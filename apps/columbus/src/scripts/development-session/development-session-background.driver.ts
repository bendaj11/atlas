import { jest } from '@jest/globals';
import {
  type DevelopmentSessionRequest,
  loadDevelopmentSession,
} from './development-session-background';

export class DevelopmentSessionBackgroundDriver {
  private request: DevelopmentSessionRequest = {
    hostId: 'shop',
    previewUrl: 'http://localhost:4300/dashboard',
  };
  private readonly fetchJson = jest.fn<(url: string) => Promise<unknown>>();
  private result: unknown;
  private error: unknown;

  constructor() {
    this.fetchJson.mockResolvedValue({
      schemaVersion: '1',
      hostId: 'shop',
      overrides: [],
    });
  }

  readonly given = {
    request: (request: Partial<DevelopmentSessionRequest>): this => {
      this.request = { ...this.request, ...request };

      return this;
    },
    sessionResponse: (session: unknown): this => {
      this.fetchJson.mockResolvedValue(session);

      return this;
    },
  };

  readonly when = {
    sessionLoaded: async (): Promise<this> => {
      try {
        this.result = await loadDevelopmentSession(this.request, {
          fetchJson: this.fetchJson,
        });
      } catch (error) {
        this.error = error;
      }

      return this;
    },
  };

  readonly get = {
    result: (): unknown => this.result,
    errorMessage: (): string | undefined =>
      this.error instanceof Error ? this.error.message : undefined,
    requestedUrl: (): string | undefined => this.fetchJson.mock.calls[0]?.[0],
  };
}
