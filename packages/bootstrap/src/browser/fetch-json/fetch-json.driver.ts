import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { fetchBytes, fetchJson } from './index.js';

export class FetchJsonDriver {
  private url = faker.internet.url();
  private retryCount = 0;
  private readonly verify = jest.fn<(bytes: Uint8Array) => Promise<void>>();
  private verified = false;
  private readonly originalFetch = globalThis.fetch;
  private readonly originalTimeout = AbortSignal.timeout;
  private readonly timeoutSignal = new AbortController().signal;
  private readonly fetchMock = jest.fn<typeof fetch>();
  private result!: Promise<unknown>;

  constructor() {
    this.verify.mockResolvedValue(undefined);
    AbortSignal.timeout = jest
      .fn<typeof AbortSignal.timeout>()
      .mockReturnValue(this.timeoutSignal);
    globalThis.fetch = this.fetchMock;
  }

  readonly given = {
    url: (url: string) => {
      this.url = url;

      return this;
    },
    retryCount: (retryCount: number) => {
      this.retryCount = retryCount;

      return this;
    },
    verification: () => {
      this.verified = true;

      return this;
    },
    response: (body: string, status = 200) => {
      this.fetchMock.mockResolvedValueOnce(new Response(body, { status }));

      return this;
    },
    verificationFailure: (error: Error) => {
      this.verify.mockRejectedValueOnce(error);

      return this;
    },
    failure: (error: Error) => {
      this.fetchMock.mockRejectedValueOnce(error);

      return this;
    },
  };

  readonly when = {
    jsonRequested: () => {
      this.result = fetchJson({
        url: this.url,
        runtime: { resourcesRetryCount: this.retryCount },
        ...(this.verified ? { verify: this.verify } : {}),
      }).finally(() => this.restore());
    },
    bytesRequested: () => {
      this.result = fetchBytes({
        url: this.url,
        runtime: { resourcesRetryCount: this.retryCount },
      }).finally(() => this.restore());
    },
  };

  readonly get = {
    result: () => this.result,
    fetchMock: () => this.fetchMock,
    verifyMock: () => this.verify,
    cacheModes: () => this.fetchMock.mock.calls.map(([, init]) => init?.cache),
    timeoutSignal: () => this.timeoutSignal,
  };

  private restore(): void {
    globalThis.fetch = this.originalFetch;
    AbortSignal.timeout = this.originalTimeout;
  }
}
