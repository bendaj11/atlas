import { faker } from '@faker-js/faker';
import { FetchBytesDriver } from './fetch-bytes.driver.js';

describe('fetchBytesFromNetwork', () => {
  const url = faker.internet.url();
  let driver: FetchBytesDriver;

  beforeEach(() => {
    driver = new FetchBytesDriver();
  });

  afterEach(() => {
    driver.restore();
  });

  it('should return the response bytes when the response is ok', async () => {
    const text = faker.lorem.word();
    await driver.given.response(new Response(text)).when.fetched(url);

    expect(new TextDecoder().decode(driver.get.bytes())).toBe(text);
  });

  it('should pass the abort signal to fetch when a signal is given', async () => {
    const { signal } = new AbortController();
    await driver.given.response(new Response('')).when.fetched(url, signal);

    expect(driver.get.fetchMock()).toHaveBeenCalledWith(url, { signal });
  });

  it('should throw ATLAS_RESOURCE_HTTP_ERROR when the response is not ok', async () => {
    await driver.given
      .response(new Response('', { status: 404 }))
      .when.fetched(url);

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_RESOURCE_HTTP_ERROR',
    });
  });

  it('should mark the failure as not retryable when the status is a client error', async () => {
    await driver.given
      .response(new Response('', { status: 404 }))
      .when.fetched(url);

    expect(driver.get.error()).toMatchObject({ retryable: false });
  });

  it('should mark the failure as retryable when the status is a server error', async () => {
    await driver.given
      .response(new Response('', { status: 503 }))
      .when.fetched(url);

    expect(driver.get.error()).toMatchObject({ retryable: true });
  });
});
