import { faker } from '@faker-js/faker';
import { aHostRuntimeConfig, aRegistryUrl } from '@atlas/testkit';
import { RuntimeConfigDriver } from './runtime-config.driver.js';

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const DEVELOPMENT_ONLY_FIELDS = [
  'developmentSessionUrl',
  'resourcesTimeoutMs',
  'resourcesRetryCount',
];

describe('resolveAtlasRuntimeConfig', () => {
  let driver: RuntimeConfigDriver;

  beforeEach(() => {
    driver = new RuntimeConfigDriver();
  });

  describe('when the runtime config belongs to a host URL', () => {
    const hostUrl = 'https://host.example/orders/42';

    beforeEach(() => {
      driver.given.hostUrl(hostUrl);
    });

    it('should resolve a root-relative artifact registry against the host origin when resolved', () => {
      driver.given
        .value(aHostRuntimeConfig({ artifactRegistryUrl: '/atlas' }))
        .when.resolved();

      expect(driver.get.runtime()?.artifactRegistryUrl).toBe(
        'https://host.example/atlas',
      );
    });

    it('should resolve a relative environment registry without its trailing slash when resolved', () => {
      driver.given
        .value(
          aHostRuntimeConfig({ environmentRegistryUrl: './environments/' }),
        )
        .when.resolved();

      expect(driver.get.runtime()?.environmentRegistryUrl).toBe(
        'https://host.example/environments',
      );
    });

    it('should preserve an absolute artifact registry when resolved', () => {
      const artifactRegistryUrl = aRegistryUrl();
      driver.given
        .value(aHostRuntimeConfig({ artifactRegistryUrl }))
        .when.resolved();

      expect(driver.get.runtime()?.artifactRegistryUrl).toBe(
        artifactRegistryUrl,
      );
    });

    it('should omit the environment registry when the config has none', () => {
      driver.given.value(aHostRuntimeConfig()).when.resolved();

      expect(driver.get.runtime()).not.toHaveProperty('environmentRegistryUrl');
    });

    it.each(LOOPBACK_HOSTS)(
      'should preserve an http artifact registry on %s when resolved',
      (host) => {
        driver.given
          .value(
            aHostRuntimeConfig({ artifactRegistryUrl: `http://${host}:4400` }),
          )
          .when.resolved();

        expect(driver.get.runtime()?.artifactRegistryUrl).toBe(
          `http://${host}:4400`,
        );
      },
    );

    it('should reject an insecure absolute artifact registry when resolved', () => {
      driver.given
        .value(
          aHostRuntimeConfig({
            artifactRegistryUrl: 'http://registry.example',
          }),
        )
        .when.resolved();

      expect(driver.get.error()).toMatchObject({
        code: 'RUNTIME_CONFIG_INVALID',
        summary:
          'Atlas runtime artifactRegistryUrl "http://registry.example" requires HTTPS outside local development.',
      });
    });

    it('should reject a non-object config when resolved', () => {
      driver.given.value(faker.lorem.word()).when.resolved();

      expect(driver.get.error()).toMatchObject({
        code: 'RUNTIME_CONFIG_INVALID',
        summary: 'Atlas runtime config must be a JSON object.',
      });
    });

    it('should reject an unsupported schema version when resolved', () => {
      driver.given
        .value({ ...aHostRuntimeConfig(), schemaVersion: 'v2' })
        .when.resolved();

      expect(driver.get.error()).toMatchObject({
        code: 'RUNTIME_CONFIG_INVALID',
        summary: 'Atlas runtime config requires schemaVersion "v1", got "v2".',
      });
    });

    it('should preserve a host version when the config has one', () => {
      const hostVersion = faker.system.semver();
      driver.given.value(aHostRuntimeConfig({ hostVersion })).when.resolved();

      expect(driver.get.runtime()?.hostVersion).toBe(hostVersion);
    });

    it('should reject a host version that is not a URL-safe path segment when resolved', () => {
      driver.given
        .value(aHostRuntimeConfig({ hostVersion: '1.0/beta' }))
        .when.resolved();

      expect(driver.get.error()).toMatchObject({
        code: 'RUNTIME_CONFIG_INVALID',
        summary:
          'Atlas runtime hostVersion "1.0/beta" must be a URL-safe path segment.',
      });
    });

    it('should reject a missing artifact registry when resolved', () => {
      driver.given
        .value({ ...aHostRuntimeConfig(), artifactRegistryUrl: undefined })
        .when.resolved();

      expect(driver.get.error()).toMatchObject({
        code: 'RUNTIME_CONFIG_INVALID',
        summary: 'Atlas runtime artifactRegistryUrl is required.',
      });
    });

    it('should reject a host id that is not a URL-safe path segment when resolved', () => {
      driver.given
        .value(aHostRuntimeConfig({ hostId: 'orders/admin' }))
        .when.resolved();

      expect(driver.get.error()).toMatchObject({
        code: 'RUNTIME_CONFIG_INVALID',
        summary:
          'Atlas runtime hostId "orders/admin" must be a URL-safe path segment.',
      });
    });

    it('should reject an unknown field when resolved', () => {
      driver.given
        .value({ ...aHostRuntimeConfig(), registryUrl: aRegistryUrl() })
        .when.resolved();

      expect(driver.get.error()).toMatchObject({
        code: 'RUNTIME_CONFIG_INVALID',
        summary: expect.stringMatching(/unsupported fields .*: registryUrl\.$/),
      });
    });

    it.each(DEVELOPMENT_ONLY_FIELDS)(
      'should reject %s when the environment is not development',
      (field) => {
        driver.given
          .value({
            ...aHostRuntimeConfig({ environment: 'production' }),
            [field]: 1,
          })
          .when.resolved();

        expect(driver.get.error()).toMatchObject({
          code: 'RUNTIME_CONFIG_INVALID',
          summary: expect.stringMatching(
            `unsupported fields for environment "production": ${field}\\.$`,
          ),
        });
      },
    );

    describe('when the environment is development', () => {
      const environment = 'development';

      it('should accept a loopback development session URL when resolved', () => {
        const developmentSessionUrl = 'http://localhost:4400/session.json';
        driver.given
          .value(aHostRuntimeConfig({ environment, developmentSessionUrl }))
          .when.resolved();

        expect(driver.get.runtime()?.developmentSessionUrl).toBe(
          developmentSessionUrl,
        );
      });

      it('should reject a non-loopback development session URL when resolved', () => {
        driver.given
          .value(
            aHostRuntimeConfig({
              environment,
              developmentSessionUrl: 'https://session.example/session.json',
            }),
          )
          .when.resolved();

        expect(driver.get.error()).toMatchObject({
          code: 'RUNTIME_CONFIG_INVALID',
          summary:
            'Atlas runtime developmentSessionUrl "https://session.example/session.json" must be an absolute http loopback URL.',
        });
      });

      it('should reject a non-string development session URL when resolved', () => {
        driver.given
          .value({
            ...aHostRuntimeConfig({ environment }),
            developmentSessionUrl: 4400,
          })
          .when.resolved();

        expect(driver.get.error()).toMatchObject({
          code: 'RUNTIME_CONFIG_INVALID',
          summary:
            'Atlas runtime developmentSessionUrl 4400 must be an absolute http loopback URL.',
        });
      });

      it('should reject a negative retry count when resolved', () => {
        driver.given
          .value(aHostRuntimeConfig({ environment, resourcesRetryCount: -1 }))
          .when.resolved();

        expect(driver.get.error()).toMatchObject({
          code: 'RUNTIME_CONFIG_INVALID',
          summary:
            'Atlas runtime resourcesRetryCount -1 must be an integer of at least 0.',
        });
      });

      it('should reject a zero timeout when resolved', () => {
        driver.given
          .value(aHostRuntimeConfig({ environment, resourcesTimeoutMs: 0 }))
          .when.resolved();

        expect(driver.get.error()).toMatchObject({
          code: 'RUNTIME_CONFIG_INVALID',
          summary:
            'Atlas runtime resourcesTimeoutMs 0 must be an integer of at least 1.',
        });
      });
    });
  });

  describe('when no host URL is available', () => {
    beforeEach(() => {
      driver.given.hostUrl(undefined);
    });

    it('should preserve an absolute artifact registry when resolved', () => {
      const artifactRegistryUrl = aRegistryUrl();
      driver.given
        .value(aHostRuntimeConfig({ artifactRegistryUrl }))
        .when.resolved();

      expect(driver.get.runtime()?.artifactRegistryUrl).toBe(
        artifactRegistryUrl,
      );
    });

    it('should reject a relative artifact registry when resolved', () => {
      driver.given
        .value(aHostRuntimeConfig({ artifactRegistryUrl: '/atlas' }))
        .when.resolved();

      expect(driver.get.error()).toMatchObject({
        code: 'RUNTIME_CONFIG_INVALID',
        summary:
          'Atlas runtime artifactRegistryUrl "/atlas" is relative and requires a host URL to resolve against.',
      });
    });
  });
});

describe('assertAtlasRuntimeConfig', () => {
  let driver: RuntimeConfigDriver;

  beforeEach(() => {
    driver = new RuntimeConfigDriver();
  });

  it('should accept an absolute registry config when asserted', () => {
    driver.given.value(aHostRuntimeConfig()).when.asserted();

    expect(driver.get.error()).toBeUndefined();
  });

  it('should reject a missing artifact registry when asserted', () => {
    driver.given
      .value({ ...aHostRuntimeConfig(), artifactRegistryUrl: undefined })
      .when.asserted();

    expect(driver.get.error()).toMatchObject({
      code: 'RUNTIME_CONFIG_INVALID',
      summary: 'Atlas runtime artifactRegistryUrl is required.',
    });
  });

  it('should reject a relative artifact registry when asserted', () => {
    driver.given
      .value(aHostRuntimeConfig({ artifactRegistryUrl: '/atlas' }))
      .when.asserted();

    expect(driver.get.error()).toMatchObject({
      code: 'RUNTIME_CONFIG_INVALID',
      summary:
        'Atlas runtime artifactRegistryUrl "/atlas" must be an absolute URL.',
    });
  });

  it('should reject an environment registry with a trailing slash when asserted', () => {
    const environmentRegistryUrl = `${aRegistryUrl()}/`;
    driver.given
      .value(aHostRuntimeConfig({ environmentRegistryUrl }))
      .when.asserted();

    expect(driver.get.error()).toMatchObject({
      code: 'RUNTIME_CONFIG_INVALID',
      summary: `Atlas runtime environmentRegistryUrl "${environmentRegistryUrl}" must be a normalized registry root without credentials, query, hash, or trailing slash.`,
    });
  });
});
