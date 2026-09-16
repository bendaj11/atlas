import { beforeEach, describe, expect, it } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { FetchJsonDriver } from './fetch-json.driver.js';

describe('fetchJson', () => {
  let driver: FetchJsonDriver;

  beforeEach(() => {
    driver = new FetchJsonDriver();
  });

  it('should parse JSON response when request succeeds', async () => {
    driver.given
      .successfulResponse({ name: faker.person.fullName() })
      .when.request();

    await expect(driver.get.response()).resolves.toEqual(
      driver.get.responseBody(),
    );
  });

  it('should reject when request returns non-success status', async () => {
    driver.given.missingResponse(404).when.request();

    await expect(driver.get.response()).rejects.toThrow('returned HTTP 404');
  });

  it('should reject when network request fails without retries', async () => {
    driver.given.failedRequest(new Error('network unavailable')).when.request();

    await expect(driver.get.response()).rejects.toThrow('network unavailable');
  });

  it.each([
    'http://localhost:4200/remoteEntry.json',
    'http://127.0.0.1:4200/remoteEntry.json',
    'http://[::1]:4200/remoteEntry.json',
    'https://preview.example/remoteEntry.json',
    '/atlas.runtime.json',
  ])(
    'should use standard fetch options with caching and cancellation when requesting %s',
    async (url) => {
      driver.given
        .requestUrl(url)
        .given.successfulResponse({ name: faker.person.fullName() })
        .when.request();
      await driver.get.response();

      expect(driver.get.requestOptions()).toEqual({
        cache: 'no-cache',
        signal: driver.get.timeoutSignal(),
      });
    },
  );
});
