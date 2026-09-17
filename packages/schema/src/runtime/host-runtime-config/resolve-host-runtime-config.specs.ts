import { faker } from '@faker-js/faker';
import { AtlasValidationError } from '../../errors/atlas-validation-error/atlas-validation-error.js';
import { aHostRuntimeConfig, aRegistryRootUrl } from '../runtime.testkit.js';
import { ResolveHostRuntimeConfigDriver } from './resolve-host-runtime-config.driver.js';

describe('resolveAtlasRuntimeConfig', () => {
  let driver: ResolveHostRuntimeConfigDriver;

  beforeEach(() => {
    driver = new ResolveHostRuntimeConfigDriver();
  });

  describe('when a host URL is available', () => {
    const hostUrl = 'https://host.example/orders/42';

    beforeEach(() => {
      driver.given.hostUrl(hostUrl);
    });

    it('should resolve a root-relative artifact registry against the host origin when resolved', () => {
      driver.when.resolved(
        aHostRuntimeConfig({ artifactRegistryUrl: '/atlas' }),
      );

      expect(driver.get.runtime()?.artifactRegistryUrl).toBe(
        'https://host.example/atlas',
      );
    });

    it('should resolve a relative environment registry without its trailing slash when resolved', () => {
      driver.when.resolved(
        aHostRuntimeConfig({ environmentRegistryUrl: './environments/' }),
      );

      expect(driver.get.runtime()?.environmentRegistryUrl).toBe(
        'https://host.example/environments',
      );
    });

    it('should preserve an absolute artifact registry when resolved', () => {
      const artifactRegistryUrl = aRegistryRootUrl();
      driver.when.resolved(aHostRuntimeConfig({ artifactRegistryUrl }));

      expect(driver.get.runtime()?.artifactRegistryUrl).toBe(
        artifactRegistryUrl,
      );
    });

    it('should omit the environment registry when the config has none', () => {
      driver.when.resolved(aHostRuntimeConfig());

      expect(driver.get.runtime()).not.toHaveProperty('environmentRegistryUrl');
    });

    it('should preserve the remaining fields when resolved', () => {
      const config = aHostRuntimeConfig({ hostVersion: faker.system.semver() });
      driver.when.resolved(config);

      expect(driver.get.runtime()).toEqual(config);
    });

    it('should throw a validation error when a field is invalid', () => {
      driver.when.resolved({ ...aHostRuntimeConfig(), schemaVersion: 'v2' });

      expect(driver.get.error()).toBeInstanceOf(AtlasValidationError);
    });

    it('should throw a validation error when the value is not an object', () => {
      driver.when.resolved(faker.lorem.word());

      expect(driver.get.error()).toBeInstanceOf(AtlasValidationError);
    });

    it('should throw a validation error when a resolved registry is insecure', () => {
      driver.when.resolved(
        aHostRuntimeConfig({ artifactRegistryUrl: 'http://registry.example' }),
      );

      expect(driver.get.error()).toEqual(
        new AtlasValidationError('Invalid Atlas runtime config.', [
          {
            path: 'artifactRegistryUrl',
            message:
              'Expected artifactRegistryUrl "http://registry.example" to use HTTPS outside local development.',
          },
        ]),
      );
    });
  });

  describe('when no host URL is available', () => {
    beforeEach(() => {
      driver.given.hostUrl(undefined);
    });

    it('should preserve an absolute artifact registry when resolved', () => {
      const artifactRegistryUrl = aRegistryRootUrl();
      driver.when.resolved(aHostRuntimeConfig({ artifactRegistryUrl }));

      expect(driver.get.runtime()?.artifactRegistryUrl).toBe(
        artifactRegistryUrl,
      );
    });

    it('should throw a validation error when the artifact registry is relative', () => {
      driver.when.resolved(
        aHostRuntimeConfig({ artifactRegistryUrl: '/atlas' }),
      );

      expect(driver.get.error()).toEqual(
        new AtlasValidationError('Invalid Atlas runtime config.', [
          {
            path: 'artifactRegistryUrl',
            message:
              'Expected artifactRegistryUrl "/atlas" to be absolute, or a host URL to resolve it against.',
          },
        ]),
      );
    });
  });
});
