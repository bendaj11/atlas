import { jest } from '@jest/globals';

export class LocalOverrideDriver {
  private readonly fetch = jest.fn<typeof globalThis.fetch>();

  constructor() {
    globalThis.fetch = this.fetch;
  }

  readonly given = {
    fetchResponse: (response: Response) => {
      this.fetch.mockResolvedValue(response);

      return this;
    },
    fetchFailure: (error: Error) => {
      this.fetch.mockRejectedValue(error);

      return this;
    },
  };

  readonly get = {
    fetch: () => this.fetch,
  };
}
