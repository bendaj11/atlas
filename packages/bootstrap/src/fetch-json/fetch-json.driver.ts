import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { fetchJson } from './fetch-json.js';

export class FetchJsonDriver {
  private readonly url = faker.internet.url();
  private responseBody: { name: string } | undefined;
  private response: Promise<unknown> | undefined;

  readonly given = {
    successfulResponse: (responseBody: { name: string }): FetchJsonDriver => {
      this.responseBody = responseBody;
      Object.assign(globalThis, {
        fetch: jest
          .fn<typeof fetch>()
          .mockResolvedValue(
            new Response(JSON.stringify(this.responseBody), { status: 200 }),
          ),
      });
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
      });
    },
  };

  readonly get = {
    responseBody: (): { name: string } | undefined => this.responseBody,
    response: (): Promise<unknown> => this.response as Promise<unknown>,
  };
}
