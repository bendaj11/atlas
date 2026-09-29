import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { aHostCatalog } from '@atlas/testkit';
import type { PublishedCatalogLoader } from '../types.js';
import { withCatalogCache } from './published-catalog.js';

describe('withCatalogCache', () => {
  const FRESH_WINDOW_MS = 30_000;
  let load: jest.Mock<PublishedCatalogLoader>;
  let request: Parameters<PublishedCatalogLoader>[0];

  beforeEach(() => {
    jest.useFakeTimers();
    load = jest.fn<PublishedCatalogLoader>();
    request = {
      registryUrl: faker.internet.url(),
      hostId: faker.string.uuid(),
      environment: faker.word.noun(),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should load once when concurrent requests share host, environment and registry', async () => {
    load.mockResolvedValue(aHostCatalog());
    const cached = withCatalogCache(load);

    await Promise.all([cached(request), cached(request)]);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('should load once when a request repeats within the fresh window', async () => {
    load.mockResolvedValue(aHostCatalog());
    const cached = withCatalogCache(load);
    await cached(request);

    jest.advanceTimersByTime(FRESH_WINDOW_MS - 1);
    await cached(request);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('should load twice when the environment differs', async () => {
    load.mockResolvedValue(aHostCatalog());
    const cached = withCatalogCache(load);
    await cached(request);

    await cached({ ...request, environment: faker.string.uuid() });

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('should load twice when the first load fails', async () => {
    load.mockRejectedValueOnce(new Error(faker.lorem.word()));
    load.mockResolvedValueOnce(aHostCatalog());
    const cached = withCatalogCache(load);
    await cached(request).catch(() => undefined);

    await cached(request);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('should serve the stale catalog when the fresh window elapsed', async () => {
    const stale = aHostCatalog();
    load.mockResolvedValueOnce(stale);
    load.mockResolvedValueOnce(aHostCatalog());
    const cached = withCatalogCache(load);
    await cached(request);

    jest.advanceTimersByTime(FRESH_WINDOW_MS);

    expect(await cached(request)).toBe(stale);
  });

  it('should serve the refreshed catalog when the refresh finished after the fresh window elapsed', async () => {
    const refreshed = aHostCatalog();
    load.mockResolvedValueOnce(aHostCatalog());
    load.mockResolvedValueOnce(refreshed);
    const cached = withCatalogCache(load);
    await cached(request);
    jest.advanceTimersByTime(FRESH_WINDOW_MS);
    await cached(request);
    await Promise.resolve();

    expect(await cached(request)).toBe(refreshed);
  });
});
