import { jest } from '@jest/globals';
import { fetchBytesFromNetwork } from './fetch-bytes.js';

export class FetchBytesDriver {
  private readonly fetch = jest.spyOn(globalThis, 'fetch');
  private bytes: ArrayBuffer | undefined;
  private error: unknown;

  readonly given = {
    response: (response: Response) => {
      this.fetch.mockResolvedValue(response);

      return this;
    },
  };

  readonly when = {
    fetched: async (url: string, signal?: AbortSignal) => {
      try {
        this.bytes = await fetchBytesFromNetwork(url, signal);
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    bytes: () => this.bytes,
    error: () => this.error,
    fetchMock: () => this.fetch,
  };

  restore() {
    this.fetch.mockRestore();
  }
}
