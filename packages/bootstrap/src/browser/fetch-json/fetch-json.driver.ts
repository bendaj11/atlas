import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import type { validateIntegrity as validateIntegrityType } from './validate-integrity/validate-integrity.js';

const validateIntegrity = jest.fn<typeof validateIntegrityType>();
jest.unstable_mockModule('./validate-integrity/validate-integrity.js', () => ({
  validateIntegrity,
}));
const { fetchBytes, fetchJson } = await import('./index.js');

export class FetchJsonDriver {
  private url = faker.internet.url();
  private retryCount = 0;
  private integrity: string | undefined;
  private readonly originalFetch = globalThis.fetch;
  private readonly originalTimeout = AbortSignal.timeout;
  private readonly timeoutSignal = new AbortController().signal;
  private readonly fetchMock = jest.fn<typeof fetch>();
  private result!: Promise<unknown>;

  constructor() {
    validateIntegrity.mockReset();
    validateIntegrity.mockResolvedValue(undefined);
    AbortSignal.timeout = jest
      .fn<typeof AbortSignal.timeout>()
      .mockReturnValue(this.timeoutSignal);
    globalThis.fetch = this.fetchMock;
  }

  readonly given = {
    url: (url: string): FetchJsonDriver => {
      this.url = url;

      return this;
    },
    retryCount: (retryCount: number): FetchJsonDriver => {
      this.retryCount = retryCount;

      return this;
    },
    integrity: (integrity: string): FetchJsonDriver => {
      this.integrity = integrity;

      return this;
    },
    response: (body: string, status = 200): FetchJsonDriver => {
      this.fetchMock.mockResolvedValueOnce(new Response(body, { status }));

      return this;
    },
    integrityFailure: (error: Error): FetchJsonDriver => {
      validateIntegrity.mockRejectedValue(error);

      return this;
    },
    failure: (error: Error): FetchJsonDriver => {
      this.fetchMock.mockRejectedValueOnce(error);

      return this;
    },
  };

  readonly when = {
    jsonRequested: (): void => {
      this.result = fetchJson({
        url: this.url,
        runtime: { resourcesRetryCount: this.retryCount },
        ...(this.integrity === undefined ? {} : { integrity: this.integrity }),
      }).finally(() => this.restore());
    },
    bytesRequested: (): void => {
      this.result = fetchBytes({
        url: this.url,
        runtime: { resourcesRetryCount: this.retryCount },
      }).finally(() => this.restore());
    },
  };

  readonly get = {
    result: (): Promise<unknown> => this.result,
    fetchMock: (): jest.Mock<typeof fetch> => this.fetchMock,
    validateIntegrityMock: () => validateIntegrity,
    timeoutSignal: (): AbortSignal => this.timeoutSignal,
  };

  private restore(): void {
    globalThis.fetch = this.originalFetch;
    AbortSignal.timeout = this.originalTimeout;
  }
}
