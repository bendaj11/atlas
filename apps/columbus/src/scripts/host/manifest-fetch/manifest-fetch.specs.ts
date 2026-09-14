/** @jest-environment node */

import { ManifestFetchDriver } from './manifest-fetch.driver';

describe('fetchVerifiedManifest', () => {
  let driver: ManifestFetchDriver;

  beforeEach(() => {
    driver = new ManifestFetchDriver();
  });

  it('should resolve the descriptor path against the registry root when fetching', async () => {
    await driver.when.manifestFetched();

    expect(driver.get.requestedUrl()).toBe(
      'https://registry.example/apps/orders/1.0.0/manifest.json',
    );
  });

  it('should use the browser cache when fetching a manifest', async () => {
    await driver.when.manifestFetched();

    expect(driver.get.requestInit()?.cache).toBe('force-cache');
  });

  it('should return the manifest when the bytes match the descriptor', async () => {
    await driver.when.manifestFetched();

    expect(driver.get.manifestId()).toBe('orders');
  });

  it('should fail when the digest does not match', async () => {
    await driver.given
      .descriptor({ digest: `sha256:${'0'.repeat(64)}` })
      .when.manifestFetched();

    expect(driver.get.errorMessage()).toBe(
      'apps/orders/1.0.0/manifest.json failed descriptor verification.',
    );
  });

  it('should fail when the size does not match', async () => {
    await driver.given.descriptor({ size: 1 }).when.manifestFetched();

    expect(driver.get.errorMessage()).toBe(
      'apps/orders/1.0.0/manifest.json failed descriptor verification.',
    );
  });

  it('should fail when the registry responds with an error status', async () => {
    await driver.given.responseStatus(404).when.manifestFetched();

    expect(driver.get.errorMessage()).toBe(
      'https://registry.example/apps/orders/1.0.0/manifest.json returned 404.',
    );
  });
});

describe('fetchWithTimeout', () => {
  let driver: ManifestFetchDriver;

  beforeEach(() => {
    driver = new ManifestFetchDriver();
  });

  it('should bypass the cache when no cache mode is given', async () => {
    await driver.when.fetchedWithTimeout(
      'https://registry.example/registry.json',
    );

    expect(driver.get.requestInit()?.cache).toBe('no-store');
  });

  it('should attach an abort signal when fetching', async () => {
    await driver.when.fetchedWithTimeout(
      'https://registry.example/registry.json',
    );

    expect(driver.get.requestInit()?.signal).toBeInstanceOf(AbortSignal);
  });
});
