import { createHash } from 'node:crypto';
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
    'should fetch with no-cache and a timeout signal only when requesting %s',
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

  describe('when an integrity value is required', () => {
    const body = JSON.stringify({ name: faker.person.fullName() });
    const digest = createHash('sha256').update(body).digest('base64');

    it('should resolve the body when the integrity matches', async () => {
      driver.given
        .integrity(`sha256-${digest}`)
        .given.response(body)
        .when.jsonRequested();

      await expect(driver.get.result()).resolves.toEqual(JSON.parse(body));
    });

    it('should reject when the integrity does not match', async () => {
      const other = createHash('sha256')
        .update(faker.string.uuid())
        .digest('base64');
      driver.given
        .integrity(`sha256-${other}`)
        .given.response(body)
        .when.jsonRequested();

      await expect(driver.get.result()).rejects.toMatchObject({
        code: 'ARTIFACT_VERIFICATION_FAILED',
        summary: `Selected host remote entry integrity sha256-${digest} does not match manifest integrity sha256-${other}.`,
      });
    });

    it('should reject when the integrity is not a SHA-256 value', async () => {
      driver.given
        .integrity(`sha384-${digest}`)
        .given.response(body)
        .when.jsonRequested();

      await expect(driver.get.result()).rejects.toMatchObject({
        code: 'ARTIFACT_VERIFICATION_FAILED',
        summary: `Host integrity "sha384-${digest}" must be a SHA-256 SRI value starting with "sha256-".`,
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
