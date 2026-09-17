import { jest } from '@jest/globals';

export class DevelopmentSessionBackgroundDriver {
  private readonly fetchJson = jest.fn<(url: string) => Promise<unknown>>();

  readonly given = {
    session: (session: unknown) => {
      this.fetchJson.mockResolvedValue(session);

      return this;
    },
  };

  readonly get = {
    fetchJson: () => this.fetchJson,
  };
}
