import { faker } from '@faker-js/faker';
import {
  aRegistryUrl,
  aRuntimeConfig,
} from '../../testkit/manifests.testkit.js';
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
        .value(aRuntimeConfig({ artifactRegistryUrl: '/atlas' }))
        .when.resolved();

      expect(driver.get.runtime()?.artifactRegistryUrl).toBe(
        'https://host.example/atlas',
      );
    });

    it('should resolve a relative environment registry without its trailing slash when resolved', () => {
      driver.given
        .value(aRuntimeConfig({ environmentRegistryUrl: './environments/' }))
        .when.resolved();

      expect(driver.get.runtime()?.environmentRegistryUrl).toBe(
        'https://host.example/environments',
      );
    });

    it('should preserve an absolute artifact registry when resolved', () => {
      const artifactRegistryUrl = aRegistryUrl();
      driver.given
        .value(aRuntimeConfig({ artifactRegistryUrl }))
        .when.resolved();

      expect(driver.get.runtime()?.artifactRegistryUrl).toBe(
        artifactRegistryUrl,
      );
    });

    it('should omit the environment registry when the config has none', () => {
      driver.given.value(aRuntimeConfig()).when.resolved();

      expect(driver.get.runtime()).not.toHaveProperty('environmentRegistryUrl');
    });

    it.each(LOOPBACK_HOSTS)(
      'should preserve an http artifact registry on %s when resolved',
      (host) => {
        driver.given
          .value(aRuntimeConfig({ artifactRegistryUrl: `http://${host}:4400` }))
          .when.resolved();

        expect(driver.get.runtime()?.artifactRegistryUrl).toBe(
          `http://${host}:4400`,
        );
      },
    );

    it('should reject an insecure absolute artifact registry when resolved', () => {
      driver.given
        .value(
          aRuntimeConfig({ artifactRegistryUrl: 'http://registry.example' }),
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
        .value({ ...aRuntimeConfig(), schemaVersion: 'v2' })
        .when.resolved();

      expect(driver.get.error()).toMatchObject({
        code: 'RUNTIME_CONFIG_INVALID',
        summary: 'Atlas runtime config requires schemaVersion "v1", got "v2".',
      });
    });

    it('should reject a host id that is not a URL-safe path segment when resolved', () => {
      driver.given
        .value(aRuntimeConfig({ hostId: 'orders/admin' }))
        .when.resolved();

      expect(driver.get.error()).toMatchObject({
        code: 'RUNTIME_CONFIG_INVALID',
        summary:
          'Atlas runtime hostId "orders/admin" must be a URL-safe path segment.',
      });
    });

    it('should reject an unknown field when resolved', () => {
      driver.given
        .value({ ...aRuntimeConfig(), registryUrl: aRegistryUrl() })
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
            ...aRuntimeConfig({ environment: 'production' }),
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
          .value(aRuntimeConfig({ environment, developmentSessionUrl }))
          .when.resolved();

        expect(driver.get.runtime()?.developmentSessionUrl).toBe(
          developmentSessionUrl,
        );
      });

      it('should reject a non-loopback development session URL when resolved', () => {
        driver.given
          .value(
            aRuntimeConfig({
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

      it('should reject a negative retry count when resolved', () => {
        driver.given
          .value(aRuntimeConfig({ environment, resourcesRetryCount: -1 }))
          .when.resolved();

        expect(driver.get.error()).toMatchObject({
          code: 'RUNTIME_CONFIG_INVALID',
          summary:
            'Atlas runtime resourcesRetryCount -1 must be an integer of at least 0.',
        });
      });

      it('should reject a zero timeout when resolved', () => {
        driver.given
          .value(aRuntimeConfig({ environment, resourcesTimeoutMs: 0 }))
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
        .value(aRuntimeConfig({ artifactRegistryUrl }))
        .when.resolved();

      expect(driver.get.runtime()?.artifactRegistryUrl).toBe(
        artifactRegistryUrl,
      );
    });

    it('should reject a relative artifact registry when resolved', () => {
      driver.given
        .value(aRuntimeConfig({ artifactRegistryUrl: '/atlas' }))
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
    driver.given.value(aRuntimeConfig()).when.asserted();

    expect(driver.get.error()).toBeUndefined();
  });

  it('should reject a relative artifact registry when asserted', () => {
    driver.given
      .value(aRuntimeConfig({ artifactRegistryUrl: '/atlas' }))
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
      .value(aRuntimeConfig({ environmentRegistryUrl }))
      .when.asserted();

    expect(driver.get.error()).toMatchObject({
      code: 'RUNTIME_CONFIG_INVALID',
      summary: `Atlas runtime environmentRegistryUrl "${environmentRegistryUrl}" must be a normalized registry root without credentials, query, hash, or trailing slash.`,
    });
  });
});

describe('environmentRegistryUrl', () => {
  let driver: RuntimeConfigDriver;

  beforeEach(() => {
    driver = new RuntimeConfigDriver();
  });

  it('should return the artifact registry when the config has no environment registry', () => {
    const runtime = aRuntimeConfig();
    driver.given.runtime(runtime).when.environmentRegistryUrlBuilt();

    expect(driver.get.url()).toBe(runtime.artifactRegistryUrl);
  });

  it('should return the environment registry when the config has one', () => {
    const runtime = aRuntimeConfig({ environmentRegistryUrl: aRegistryUrl() });
    driver.given.runtime(runtime).when.environmentRegistryUrlBuilt();

    expect(driver.get.url()).toBe(runtime.environmentRegistryUrl);
  });
});

describe('environmentManifestUrl', () => {
  let driver: RuntimeConfigDriver;

  beforeEach(() => {
    driver = new RuntimeConfigDriver();
  });

  it('should build the host manifest path under the environment registry when built', () => {
    const runtime = aRuntimeConfig({ environmentRegistryUrl: aRegistryUrl() });
    driver.given.runtime(runtime).when.environmentManifestUrlBuilt();

    expect(driver.get.url()).toBe(
      `${runtime.environmentRegistryUrl}/environments/${runtime.environment}/hosts/${runtime.hostId}/manifest.json`,
    );
  });
});

describe('artifactUrl', () => {
  let driver: RuntimeConfigDriver;

  beforeEach(() => {
    driver = new RuntimeConfigDriver();
  });

  it('should join the path under the artifact registry when built', () => {
    const runtime = aRuntimeConfig();
    const path = `${faker.lorem.slug()}/manifest.json`;
    driver.given.runtime(runtime).when.artifactUrlBuilt(path);

    expect(driver.get.url()).toBe(`${runtime.artifactRegistryUrl}/${path}`);
  });
});
