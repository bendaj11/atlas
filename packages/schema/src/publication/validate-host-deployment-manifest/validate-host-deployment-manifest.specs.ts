import { faker } from '@faker-js/faker';
import { AtlasValidationError } from '../../errors/atlas-validation-error/atlas-validation-error.js';
import {
  aHostDeploymentManifest,
  aManifestDescriptor,
} from '../publication.testkit.js';
import { ValidateHostDeploymentManifestDriver } from './validate-host-deployment-manifest.driver.js';

describe('validateHostDeploymentManifest', () => {
  let driver: ValidateHostDeploymentManifestDriver;

  beforeEach(() => {
    driver = new ValidateHostDeploymentManifestDriver();
  });

  it('should report nothing when the deployment manifest is complete', () => {
    driver.when.validated(aHostDeploymentManifest());

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report nothing when references carry HTTP urls and widget providers are listed', () => {
    driver.when.validated(
      aHostDeploymentManifest({
        host: { ...aManifestDescriptor(), url: faker.internet.url() },
        widgetProviders: [aManifestDescriptor()],
      }),
    );

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report a single object issue when the value is not an object', () => {
    driver.when.validated(null);

    expect(driver.get.issues()).toEqual([
      {
        path: '',
        message: 'Expected the host deployment manifest to be an object.',
      },
    ]);
  });

  it('should report every required field once when the value is an empty object', () => {
    driver.when.validated({});

    expect(driver.get.issuePaths()).toEqual([
      'schemaVersion',
      'kind',
      'hostId',
      'environment',
      'deploymentRevision',
      'host',
      'apps',
    ]);
  });

  it('should report schemaVersion and kind when they are unknown', () => {
    driver.when.validated({
      ...aHostDeploymentManifest(),
      schemaVersion: 'v2',
      kind: 'deployment',
    });

    expect(driver.get.issues()).toEqual([
      { path: 'schemaVersion', message: 'Expected schemaVersion to be "v1".' },
      { path: 'kind', message: 'Expected kind to be "host-deployment".' },
    ]);
  });

  it('should report hostId when it is not a URL-safe segment', () => {
    driver.when.validated(aHostDeploymentManifest({ hostId: 'orders/admin' }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'hostId',
        message:
          'Expected host id "orders/admin" to be a URL-safe path segment.',
      },
    ]);
  });

  it('should report deploymentRevision when it is not a digest', () => {
    driver.when.validated(
      aHostDeploymentManifest({ deploymentRevision: 'sha256:test' }),
    );

    expect(driver.get.issuePaths()).toEqual(['deploymentRevision']);
  });

  it('should report the host reference fields when the host descriptor is malformed', () => {
    driver.when.validated({
      ...aHostDeploymentManifest(),
      host: {
        path: '/abs.json',
        digest: 'x',
        size: 0,
        mediaType: 'text/plain',
      },
    });

    expect(driver.get.issuePaths()).toEqual([
      'host.path',
      'host.digest',
      'host.size',
      'host.mediaType',
    ]);
  });

  it('should report the reference url when it is not HTTP(S)', () => {
    driver.when.validated(
      aHostDeploymentManifest({
        host: { ...aManifestDescriptor(), url: 'not a url' },
      }),
    );

    expect(driver.get.issues()).toEqual([
      { path: 'host.url', message: 'Expected an absolute HTTP(S) URL.' },
    ]);
  });

  it('should report apps when it is not an array', () => {
    driver.when.validated({ ...aHostDeploymentManifest(), apps: 'x' });

    expect(driver.get.issues()).toEqual([
      { path: 'apps', message: 'Expected an array of manifest references.' },
    ]);
  });

  it('should report the indexed app reference when it is not an object', () => {
    driver.when.validated({
      ...aHostDeploymentManifest(),
      apps: [aManifestDescriptor(), 'x'],
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'apps.1',
        message: 'Expected manifest descriptor to be an object.',
      },
    ]);
  });

  it('should report widgetProviders when it is not an array', () => {
    driver.when.validated({
      ...aHostDeploymentManifest(),
      widgetProviders: {},
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'widgetProviders',
        message: 'Expected an array of manifest references.',
      },
    ]);
  });
});

describe('assertHostDeploymentManifest', () => {
  let driver: ValidateHostDeploymentManifestDriver;

  beforeEach(() => {
    driver = new ValidateHostDeploymentManifestDriver();
  });

  it('should not throw when the deployment manifest is valid', () => {
    expect(() => driver.when.asserted(aHostDeploymentManifest())).not.toThrow();
  });

  it('should throw AtlasValidationError naming the deployment manifest when invalid', () => {
    expect(() =>
      driver.when.asserted({ ...aHostDeploymentManifest(), apps: 'x' }),
    ).toThrow(
      expect.objectContaining<Partial<AtlasValidationError>>({
        summary:
          'Invalid Atlas host deployment manifest. apps: Expected an array of manifest references.',
      }),
    );
  });
});
