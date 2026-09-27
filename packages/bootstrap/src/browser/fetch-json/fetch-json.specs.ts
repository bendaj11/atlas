import { faker } from '@faker-js/faker';
import { FetchJsonDriver } from './fetch-json.driver.js';

const REQUEST_URLS = [
  'http://localhost:4200/remoteEntry.json',
  'http://127.0.0.1:4200/remoteEntry.json',
  'http://[::1]:4200/remoteEntry.json',
  'https://preview.example/remoteEntry.json',
  '/atlas.runtime.json',
];

describe('fetchJson', () => {
  let driver: FetchJsonDriver;

  beforeEach(() => {
    driver = new FetchJsonDriver();
  });

  it('should resolve the parsed body when the request succeeds', async () => {
    const body = { name: faker.person.fullName() };
    driver.given.response(JSON.stringify(body)).when.jsonRequested();

    await expect(driver.get.result()).resolves.toEqual(body);
  });

  it('should reject with the HTTP status when the response is not ok', async () => {
    const url = faker.internet.url();
    driver.given.url(url).given.response('', 404).when.jsonRequested();

    await expect(driver.get.result()).rejects.toMatchObject({
      code: 'RESOURCE_UNAVAILABLE',
      summary: `Atlas could not fetch "${url}" after 1 attempt: ${url} returned HTTP 404.`,
    });
  });

  it('should reject with the network failure when fetch rejects', async () => {
    const url = faker.internet.url();
    driver.given
      .url(url)
      .given.failure(new Error('network unavailable'))
      .when.jsonRequested();

    await expect(driver.get.result()).rejects.toMatchObject({
      code: 'RESOURCE_UNAVAILABLE',
      summary: `Atlas could not fetch "${url}" after 1 attempt: network unavailable`,
    });
  });

  it('should reject with the stringified reason when fetch rejects with a non-error', async () => {
    const url = faker.internet.url();
    const reason = faker.lorem.word();
    driver.given
      .url(url)
      .given.failure(reason as never)
      .when.jsonRequested();

    await expect(driver.get.result()).rejects.toMatchObject({
      code: 'RESOURCE_UNAVAILABLE',
      summary: `Atlas could not fetch "${url}" after 1 attempt: ${reason}`,
    });
  });

  it.each(REQUEST_URLS)(
    'should revalidate with no-cache and a timeout signal when requesting unverified %s',
    async (url) => {
      driver.given.url(url).given.response('{}').when.jsonRequested();
      await driver.get.result();

      expect(driver.get.fetchMock()).toHaveBeenCalledWith(url, {
        cache: 'no-cache',
        signal: driver.get.timeoutSignal(),
      });
    },
  );

  describe('when one retry is allowed', () => {
    beforeEach(() => {
      driver.given.retryCount(1);
    });

    it('should resolve the body when the first attempt fails and the retry succeeds', async () => {
      const body = { name: faker.person.fullName() };
      driver.given
        .failure(new Error('network unavailable'))
        .given.response(JSON.stringify(body))
        .when.jsonRequested();

      await expect(driver.get.result()).resolves.toEqual(body);
    });

    it('should fetch twice when the first attempt fails', async () => {
      driver.given
        .failure(new Error('network unavailable'))
        .given.response('{}')
        .when.jsonRequested();
      await driver.get.result();

      expect(driver.get.fetchMock()).toHaveBeenCalledTimes(2);
    });

    it('should report both attempts when every attempt fails', async () => {
      const url = faker.internet.url();
      driver.given
        .url(url)
        .given.failure(new Error('first'))
        .given.failure(new Error('second'))
        .when.jsonRequested();

      await expect(driver.get.result()).rejects.toMatchObject({
        code: 'RESOURCE_UNAVAILABLE',
        summary: `Atlas could not fetch "${url}" after 2 attempts: second`,
      });
    });
  });

  describe('when the response bytes are verified', () => {
    const body = JSON.stringify({ name: faker.person.fullName() });

    beforeEach(() => {
      driver.given.verification();
    });

    it('should let the browser HTTP cache serve the first request', async () => {
      driver.given.response(body).when.jsonRequested();
      await driver.get.result();

      expect(driver.get.cacheModes()).toStrictEqual(['default']);
    });

    it('should verify the fetched bytes when requested', async () => {
      driver.given.response(body).when.jsonRequested();
      await driver.get.result();

      expect(driver.get.verifyMock()).toHaveBeenCalledWith(
        new TextEncoder().encode(body),
      );
    });

    it('should bypass the HTTP cache when cached bytes fail verification', async () => {
      driver.given
        .verificationFailure(new Error(faker.lorem.sentence()))
        .given.response(body)
        .given.response(body)
        .when.jsonRequested();
      await driver.get.result();

      expect(driver.get.cacheModes()).toStrictEqual(['default', 'reload']);
    });

    it('should resolve the network body when cached bytes fail verification', async () => {
      const fresh = { name: faker.person.fullName() };
      driver.given
        .verificationFailure(new Error(faker.lorem.sentence()))
        .given.response(body)
        .given.response(JSON.stringify(fresh))
        .when.jsonRequested();

      await expect(driver.get.result()).resolves.toEqual(fresh);
    });

    it('should keep bypassing the HTTP cache when a retry follows a failed verification', async () => {
      driver.given
        .retryCount(1)
        .given.verificationFailure(new Error(faker.lorem.sentence()))
        .given.verificationFailure(new Error(faker.lorem.sentence()))
        .given.response(body)
        .given.response(body)
        .given.response(body)
        .when.jsonRequested();
      await driver.get.result();

      expect(driver.get.cacheModes()).toStrictEqual([
        'default',
        'reload',
        'reload',
      ]);
    });

    it('should reject with the HTTP status when the network refetch fails', async () => {
      const url = faker.internet.url();
      driver.given
        .url(url)
        .given.verificationFailure(new Error(faker.lorem.sentence()))
        .given.response(body)
        .given.response('', 503)
        .when.jsonRequested();

      await expect(driver.get.result()).rejects.toMatchObject({
        code: 'RESOURCE_UNAVAILABLE',
        summary: `Atlas could not fetch "${url}" after 1 attempt: ${url} returned HTTP 503.`,
      });
    });

    it('should reject with the verification failure when network bytes also fail verification', async () => {
      const failure = new Error(faker.lorem.sentence());
      driver.given
        .verificationFailure(new Error(faker.lorem.sentence()))
        .given.verificationFailure(failure)
        .given.response(body)
        .given.response(body)
        .when.jsonRequested();

      await expect(driver.get.result()).rejects.toMatchObject({
        code: 'RESOURCE_UNAVAILABLE',
        cause: failure,
      });
    });
  });
});

describe('fetchBytes', () => {
  let driver: FetchJsonDriver;

  beforeEach(() => {
    driver = new FetchJsonDriver();
  });

  it('should resolve the raw bytes when the request succeeds', async () => {
    const body = faker.lorem.sentence();
    driver.given.response(body).when.bytesRequested();

    await expect(driver.get.result()).resolves.toEqual(
      new TextEncoder().encode(body),
    );
  });
});
