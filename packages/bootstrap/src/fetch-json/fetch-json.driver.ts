import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { fetchJson } from './fetch-json.js';

export class FetchJsonDriver {
  private url = faker.internet.url();
  private readonly originalFetch = globalThis.fetch;
  private readonly originalTimeout = AbortSignal.timeout;
  private readonly timeoutSignal = new AbortController().signal;
  private responseBody: { name: string } | undefined;
  private response: Promise<unknown> | undefined;
  private fetchMock: jest.MockedFunction<typeof fetch> | undefined;

  constructor() {
    AbortSignal.timeout = jest
      .fn<typeof AbortSignal.timeout>()
      .mockReturnValue(this.timeoutSignal);
  }

  readonly given = {
    requestUrl: (url: string): FetchJsonDriver => {
      this.url = url;
      return this;
    },
    successfulResponse: (responseBody: { name: string }): FetchJsonDriver => {
      this.responseBody = responseBody;
      this.fetchMock = jest
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify(this.responseBody), { status: 200 }),
        );
      Object.assign(globalThis, { fetch: this.fetchMock });
      return this;
    },
    missingResponse: (status: number): FetchJsonDriver => {
      Object.assign(globalThis, {
        fetch: jest
          .fn<typeof fetch>()
          .mockResolvedValue(new Response(null, { status })),
      });
      return this;
    },
    failedRequest: (error: Error): FetchJsonDriver => {
      Object.assign(globalThis, {
        fetch: jest.fn<typeof fetch>().mockRejectedValue(error),
      });
      return this;
    },
  };

  readonly when = {
    request: (): void => {
      this.response = fetchJson<{ name: string }>(this.url, {
        resourcesRetryCount: 0,
      }).finally(() => {
        globalThis.fetch = this.originalFetch;
        AbortSignal.timeout = this.originalTimeout;
      });
    },
  };

  readonly get = {
    responseBody: (): { name: string } | undefined => this.responseBody,
    response: (): Promise<unknown> => this.response as Promise<unknown>,
    requestOptions: (): RequestInit | undefined =>
      this.fetchMock?.mock.calls[0]?.[1],
    timeoutSignal: (): AbortSignal => this.timeoutSignal,
  };
}
