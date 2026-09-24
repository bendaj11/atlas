import { faker } from '@faker-js/faker';
import {
  aHostCatalog,
  aHostManifest,
  aRoutePlacement,
  anAppManifest,
} from '@atlas/testkit';
import { aRouteContribution } from '@atlas/testkit/internal';
import { ValidateAtlasHostCatalogDriver } from './validate-atlas-host-catalog.driver.js';

describe('validateAtlasHostCatalog', () => {
  let driver: ValidateAtlasHostCatalogDriver;

  beforeEach(() => {
    driver = new ValidateAtlasHostCatalogDriver();
  });

  it('should report nothing when the catalog holds a host and valid apps', () => {
    driver.when.validated(
      aHostCatalog({ apps: [anAppManifest(), anAppManifest()] }),
    );

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report nothing when widgetProviders hold valid apps', () => {
    driver.when.validated(aHostCatalog({ widgetProviders: [anAppManifest()] }));

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report catalog fields and the nested host when the value is not an object', () => {
    driver.when.validated(faker.lorem.word());

    expect(driver.get.issuePaths()).toEqual([
      'schemaVersion',
      'hostId',
      'generatedAt',
      'revision',
      'host.schemaVersion',
      'host.kind',
      'host.id',
      'host.name',
      'host.buildId',
      'host.createdAt',
      'host.channel',
      'host.framework',
      'host.version',
      'host.requiredLoaderApiVersion',
      'host.remoteEntryUrl',
      'host.exposes',
      'apps',
    ]);
  });

  it('should report schemaVersion when it is not "1"', () => {
    driver.when.validated({ ...aHostCatalog(), schemaVersion: '2' });

    expect(driver.get.issues()).toEqual([
      { path: 'schemaVersion', message: 'Expected schemaVersion to be "1".' },
    ]);
  });

  it('should report hostId when it contains traversal', () => {
    const host = aHostManifest({ id: '../host' });
    driver.when.validated(aHostCatalog({ host, hostId: host.id }));

    expect(driver.get.issuePaths()).toEqual(['hostId', 'host.id']);
  });

  it('should report host.id when it differs from the catalog hostId', () => {
    driver.when.validated(
      aHostCatalog({ hostId: faker.string.uuid(), host: aHostManifest() }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'host.id',
        message: 'Expected selected host id to match catalog hostId.',
      },
    ]);
  });

  it('should report apps when it is not an array', () => {
    driver.when.validated({ ...aHostCatalog(), apps: 'invalid' });

    expect(driver.get.issues()).toEqual([
      { path: 'apps', message: 'Expected an array of app manifests.' },
    ]);
  });

  it('should report widgetProviders when it is not an array', () => {
    driver.when.validated({ ...aHostCatalog(), widgetProviders: {} });

    expect(driver.get.issues()).toEqual([
      {
        path: 'widgetProviders',
        message: 'Expected an array of app manifests.',
      },
    ]);
  });

  it('should prefix nested app issues with their index when an app is invalid', () => {
    driver.when.validated(
      aHostCatalog({
        apps: [anAppManifest(), anAppManifest({ version: 'latest' })],
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'apps.1.version',
        message: 'Expected a semantic version such as 1.2.3.',
      },
    ]);
  });

  it('should report the second app id when two apps share one', () => {
    const id = faker.string.uuid();
    driver.when.validated(
      aHostCatalog({ apps: [anAppManifest({ id }), anAppManifest({ id })] }),
    );

    expect(driver.get.issues()).toEqual([
      { path: 'apps.1.id', message: `Duplicate app id "${id}".` },
    ]);
  });

  it('should report the second provider id when two widget providers share one', () => {
    const id = faker.string.uuid();
    driver.when.validated(
      aHostCatalog({
        widgetProviders: [anAppManifest({ id }), anAppManifest({ id })],
      }),
    );

    expect(driver.get.issues()).toEqual([
      { path: 'widgetProviders.1.id', message: `Duplicate app id "${id}".` },
    ]);
  });

  it('should report nothing when two apps own the same route on the same host', () => {
    const route = aRoutePlacement({
      route: aRouteContribution({ path: '/workspace' }),
    });
    driver.when.validated(
      aHostCatalog({
        apps: [
          anAppManifest({ placements: [route] }),
          anAppManifest({ placements: [route] }),
        ],
      }),
    );

    expect(driver.get.issues()).toEqual([]);
  });
});
