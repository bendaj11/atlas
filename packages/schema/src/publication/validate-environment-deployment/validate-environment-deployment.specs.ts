import { AtlasValidationError } from '../../errors/atlas-validation-error/atlas-validation-error.js';
import { anIdentifier } from '../../manifest/manifest.testkit.js';
import {
  aReleaseVersion,
  anEnvironmentDeployment,
} from '../publication.testkit.js';
import { ValidateEnvironmentDeploymentDriver } from './validate-environment-deployment.driver.js';

describe('validateEnvironmentDeployment', () => {
  let driver: ValidateEnvironmentDeploymentDriver;

  beforeEach(() => {
    driver = new ValidateEnvironmentDeploymentDriver();
  });

  it('should report nothing when the deployment is complete', () => {
    driver.when.validated(anEnvironmentDeployment());

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report nothing when hosts and apps are empty', () => {
    driver.when.validated(anEnvironmentDeployment({ hosts: {}, apps: {} }));

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report a single object issue when the value is not an object', () => {
    driver.when.validated([]);

    expect(driver.get.issues()).toEqual([
      {
        path: '',
        message: 'Expected the environment deployment to be an object.',
      },
    ]);
  });

  it('should report every required field once when the value is an empty object', () => {
    driver.when.validated({});

    expect(driver.get.issuePaths()).toEqual([
      'schemaVersion',
      'environment',
      'revision',
      'updatedAt',
      'hosts',
      'apps',
    ]);
  });

  it('should report schemaVersion when it is not "v1"', () => {
    driver.when.validated(
      anEnvironmentDeployment({ schemaVersion: 'v2' as 'v1' }),
    );

    expect(driver.get.issues()).toEqual([
      { path: 'schemaVersion', message: 'Expected schemaVersion to be "v1".' },
    ]);
  });

  it('should report revision when it is not a digest', () => {
    driver.when.validated(
      anEnvironmentDeployment({ revision: 'sha256:x' as never }),
    );

    expect(driver.get.issuePaths()).toEqual(['revision']);
  });

  it.each(['2026-08-26', '2026-08-26T00:00:00Z', 'yesterday'])(
    'should report updatedAt when it is "%s"',
    (updatedAt) => {
      driver.when.validated(anEnvironmentDeployment({ updatedAt }));

      expect(driver.get.issues()).toEqual([
        {
          path: 'updatedAt',
          message:
            'Expected updatedAt to be an ISO date-time such as 2026-01-01T00:00:00.000Z.',
        },
      ]);
    },
  );

  it('should report the selection id when it is not a URL-safe segment', () => {
    driver.when.validated(
      anEnvironmentDeployment({
        hosts: { 'orders/admin': { version: aReleaseVersion() } },
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'hosts.orders/admin',
        message:
          'Expected artifact id "orders/admin" to be a URL-safe path segment.',
      },
    ]);
  });

  it('should report the selection when it is not an object', () => {
    const id = anIdentifier();
    driver.when.validated(
      anEnvironmentDeployment({ apps: { [id]: 'latest' as never } }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: `apps.${id}`,
        message: 'Expected a selection object with a version.',
      },
    ]);
  });

  it('should report the selection version when it is unsafe', () => {
    const id = anIdentifier();
    driver.when.validated(
      anEnvironmentDeployment({ hosts: { [id]: { version: '../unsafe' } } }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: `hosts.${id}.version`,
        message:
          'Expected release version "../unsafe" to be a URL-safe path segment.',
      },
    ]);
  });
});

describe('assertEnvironmentDeployment', () => {
  let driver: ValidateEnvironmentDeploymentDriver;

  beforeEach(() => {
    driver = new ValidateEnvironmentDeploymentDriver();
  });

  it('should not throw when the deployment is valid', () => {
    expect(() => driver.when.asserted(anEnvironmentDeployment())).not.toThrow();
  });

  it('should throw AtlasValidationError naming the deployment when invalid', () => {
    expect(() =>
      driver.when.asserted(anEnvironmentDeployment({ hosts: [] as never })),
    ).toThrow(
      expect.objectContaining<Partial<AtlasValidationError>>({
        summary:
          'Invalid Atlas environment deployment. hosts: Expected an object keyed by artifact id.',
      }),
    );
  });
});
