/** @jest-environment node */

import { faker } from '@faker-js/faker';
import { anAppManifest, aRegistryUrl } from '@atlas/testkit';
import { aPublishedArtifact } from '../../testkit/registry.testkit';
import {
  fetchVerifiedManifest,
  fetchWithTimeout,
  manifestReference,
} from './manifest-fetch';
import { ManifestFetchDriver } from './manifest-fetch.driver';

describe('manifestReference', () => {
  it('should resolve the descriptor path against the registry root when built', () => {
    const registryRoot = aRegistryUrl();
    const { descriptor } = aPublishedArtifact(anAppManifest());

    expect(manifestReference(registryRoot, descriptor)).toStrictEqual({
      ...descriptor,
      url: `${registryRoot}/${descriptor.path}`,
    });
  });
});

describe('fetchVerifiedManifest', () => {
  let driver: ManifestFetchDriver;

  beforeEach(() => {
    driver = new ManifestFetchDriver();
  });

  describe('when the registry responds with the published bytes', () => {
    const published = aPublishedArtifact(
      anAppManifest({ channel: 'production' }),
    );
    const url = `${aRegistryUrl()}/${published.path}`;

    beforeEach(() => {
      driver.given.fetchResponse(
        new Response(new Uint8Array(published.bytes), { status: 200 }),
      );
    });

    it('should fetch the reference url through the browser cache when fetched', async () => {
      await fetchVerifiedManifest({ ...published.descriptor, url });

      expect(driver.get.fetch()).toHaveBeenCalledWith(url, {
        cache: 'force-cache',
        signal: expect.any(AbortSignal),
      });
    });

    it('should return the manifest when the bytes match the descriptor', async () => {
      await expect(
        fetchVerifiedManifest({ ...published.descriptor, url }),
      ).resolves.toMatchObject({
        id: published.manifest.id,
        version: published.manifest.version,
      });
    });

    it('should reject when the digest does not match', async () => {
      await expect(
        fetchVerifiedManifest({
          ...published.descriptor,
          digest: `sha256:${faker.string.hexadecimal({ length: 64, prefix: '' })}`,
          url,
        }),
      ).rejects.toThrow(`${published.path} failed descriptor verification.`);
    });

    it('should reject when the size does not match', async () => {
      await expect(
        fetchVerifiedManifest({
          ...published.descriptor,
          size: published.descriptor.size + 1,
          url,
        }),
      ).rejects.toThrow(`${published.path} failed descriptor verification.`);
    });
  });

  it('should reject when the registry responds with an error status', async () => {
    const published = aPublishedArtifact(anAppManifest());
    const url = `${aRegistryUrl()}/${published.path}`;

    driver.given.fetchResponse(new Response(null, { status: 404 }));

    await expect(
      fetchVerifiedManifest({ ...published.descriptor, url }),
    ).rejects.toThrow(`${url} returned 404.`);
  });
});

describe('fetchWithTimeout', () => {
  let driver: ManifestFetchDriver;

  beforeEach(() => {
    driver = new ManifestFetchDriver();
  });

  it('should bypass the cache and attach an abort signal when no cache mode is given', async () => {
    const url = faker.internet.url();

    driver.given.fetchResponse(new Response(null, { status: 200 }));

    await fetchWithTimeout(url);

    expect(driver.get.fetch()).toHaveBeenCalledWith(url, {
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    });
  });

  it('should use the given cache mode when one is given', async () => {
    const url = faker.internet.url();

    driver.given.fetchResponse(new Response(null, { status: 200 }));

    await fetchWithTimeout(url, 'force-cache');

    expect(driver.get.fetch()).toHaveBeenCalledWith(url, {
      cache: 'force-cache',
      signal: expect.any(AbortSignal),
    });
  });

  it('should return the response when fetched', async () => {
    const response = new Response(null, { status: 200 });

    driver.given.fetchResponse(response);

    await expect(fetchWithTimeout(faker.internet.url())).resolves.toBe(
      response,
    );
  });
});
