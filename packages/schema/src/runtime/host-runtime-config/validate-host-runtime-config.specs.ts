import { faker } from '@faker-js/faker';
import { aHostRuntimeConfig } from '@atlas/testkit';
import { aRegistryUrl } from '@atlas/testkit/internal';
import { AtlasValidationError } from '../../errors/atlas-validation-error/atlas-validation-error.js';
import { ValidateHostRuntimeConfigDriver } from './validate-host-runtime-config.driver.js';

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const DEVELOPMENT_ONLY_FIELDS = [
  'developmentSessionUrl',
  'resourcesTimeoutMs',
  'resourcesRetryCount',
];

describe('validateAtlasHostRuntimeConfig', () => {
  let driver: ValidateHostRuntimeConfigDriver;

  beforeEach(() => {
    driver = new ValidateHostRuntimeConfigDriver();
  });

  it('should report nothing when the config is complete', () => {
    driver.when.validated(aHostRuntimeConfig());

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report nothing when the config carries a host version and environment registry', () => {
    driver.when.validated(
      aHostRuntimeConfig({
        hostVersion: faker.system.semver(),
        environmentRegistryUrl: aRegistryUrl(),
      }),
    );

    expect(driver.get.issues()).toEqual([]);
  });

  it.each(LOOPBACK_HOSTS)(
    'should report nothing when the artifact registry is http on %s',
    (host) => {
      driver.when.validated(
        aHostRuntimeConfig({ artifactRegistryUrl: `http://${host}:4400` }),
      );

      expect(driver.get.issues()).toEqual([]);
    },
  );

  it('should report a single object issue when the value is not an object', () => {
    driver.when.validated(faker.lorem.word());

    expect(driver.get.issues()).toEqual([
      { path: '', message: 'Expected the runtime config to be an object.' },
    ]);
  });

  it('should report every required field once when the value is an empty object', () => {
    driver.when.validated({});

    expect(driver.get.issuePaths()).toEqual([
      'schemaVersion',
      'hostId',
      'environment',
      'artifactRegistryUrl',
    ]);
  });

  it('should report the schema version when it is unknown', () => {
    driver.when.validated({ ...aHostRuntimeConfig(), schemaVersion: 'v2' });

    expect(driver.get.issuePaths()).toEqual(['schemaVersion']);
  });

  it('should report the host id when it is not a URL-safe path segment', () => {
    driver.when.validated(aHostRuntimeConfig({ hostId: 'orders/admin' }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'hostId',
        message:
          'Expected hostId "orders/admin" to be a URL-safe path segment.',
      },
    ]);
  });

  it('should report the host version when it is not a URL-safe path segment', () => {
    driver.when.validated(aHostRuntimeConfig({ hostVersion: '1.0/beta' }));

    expect(driver.get.issuePaths()).toEqual(['hostVersion']);
  });

  it('should report an unknown field when the config carries one', () => {
    const environment = faker.word.noun();
    driver.when.validated({
      ...aHostRuntimeConfig({ environment }),
      registryUrl: aRegistryUrl(),
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'registryUrl',
        message: `Unexpected field registryUrl for environment "${environment}".`,
      },
    ]);
  });

  it.each(DEVELOPMENT_ONLY_FIELDS)(
    'should report %s when the environment is not development',
    (field) => {
      driver.when.validated({
        ...aHostRuntimeConfig({ environment: 'production' }),
        [field]: 1,
      });

      expect(driver.get.issuePaths()).toEqual([field]);
    },
  );

  it('should report an insecure artifact registry when it is http outside loopback', () => {
    driver.when.validated(
      aHostRuntimeConfig({ artifactRegistryUrl: 'http://registry.example' }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'artifactRegistryUrl',
        message:
          'Expected artifactRegistryUrl "http://registry.example" to use HTTPS outside local development.',
      },
    ]);
  });

  it('should report a relative artifact registry when validated', () => {
    driver.when.validated(
      aHostRuntimeConfig({ artifactRegistryUrl: '/atlas' }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'artifactRegistryUrl',
        message: 'Expected artifactRegistryUrl "/atlas" to be an absolute URL.',
      },
    ]);
  });

  it('should report an environment registry with a trailing slash when validated', () => {
    const environmentRegistryUrl = `${aRegistryUrl()}/`;
    driver.when.validated(aHostRuntimeConfig({ environmentRegistryUrl }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'environmentRegistryUrl',
        message: `Expected environmentRegistryUrl "${environmentRegistryUrl}" to be a normalized registry root without credentials, query, hash, or trailing slash.`,
      },
    ]);
  });

  describe('when the environment is development', () => {
    const environment = 'development';

    it('should report nothing when the development fields are valid', () => {
      driver.when.validated(
        aHostRuntimeConfig({
          environment,
          developmentSessionUrl: 'http://localhost:4400/session.json',
          resourcesRetryCount: 0,
          resourcesTimeoutMs: 1,
        }),
      );

      expect(driver.get.issues()).toEqual([]);
    });

    it('should report the development session URL when it is not loopback', () => {
      driver.when.validated(
        aHostRuntimeConfig({
          environment,
          developmentSessionUrl: 'https://session.example/session.json',
        }),
      );

      expect(driver.get.issues()).toEqual([
        {
          path: 'developmentSessionUrl',
          message:
            'Expected developmentSessionUrl "https://session.example/session.json" to be an absolute http loopback URL.',
        },
      ]);
    });

    it('should report the development session URL when it is not a string', () => {
      driver.when.validated({
        ...aHostRuntimeConfig(),
        environment,
        developmentSessionUrl: 4400,
      });

      expect(driver.get.issuePaths()).toEqual(['developmentSessionUrl']);
    });

    it('should report the retry count when it is negative', () => {
      driver.when.validated(
        aHostRuntimeConfig({ environment, resourcesRetryCount: -1 }),
      );

      expect(driver.get.issues()).toEqual([
        {
          path: 'resourcesRetryCount',
          message:
            'Expected resourcesRetryCount to be an integer of at least 0.',
        },
      ]);
    });

    it('should report the timeout when it is zero', () => {
      driver.when.validated(
        aHostRuntimeConfig({ environment, resourcesTimeoutMs: 0 }),
      );

      expect(driver.get.issues()).toEqual([
        {
          path: 'resourcesTimeoutMs',
          message:
            'Expected resourcesTimeoutMs to be an integer of at least 1.',
        },
      ]);
    });
  });
});

describe('assertAtlasHostRuntimeConfig', () => {
  let driver: ValidateHostRuntimeConfigDriver;

  beforeEach(() => {
    driver = new ValidateHostRuntimeConfigDriver();
  });

  it('should not throw when the config is valid', () => {
    driver.when.asserted(aHostRuntimeConfig());

    expect(driver.get.error()).toBeUndefined();
  });

  it('should throw a validation error listing the issues when the config is invalid', () => {
    driver.when.asserted(aHostRuntimeConfig({ artifactRegistryUrl: '/atlas' }));

    expect(driver.get.error()).toEqual(
      new AtlasValidationError('Invalid Atlas runtime config.', [
        {
          path: 'artifactRegistryUrl',
          message:
            'Expected artifactRegistryUrl "/atlas" to be an absolute URL.',
        },
      ]),
    );
  });
});
