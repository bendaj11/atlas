/** @jest-environment jsdom */

import { HostCatalogDriver } from './host-catalog.driver';

const RUNTIME_URL = '/atlas.runtime.json';
const DEV_SESSION_URL = 'http://localhost:4400/atlas.dev-session.json';
const DEV_CONFIG = {
  environment: 'development',
  developmentSessionUrl: DEV_SESSION_URL,
};

describe('readRuntimeConfig', () => {
  let driver: HostCatalogDriver;

  beforeEach(() => {
    driver = new HostCatalogDriver();
  });

  it('should resolve the runtime config when the page serves it', async () => {
    await driver.given
      .response(RUNTIME_URL, {
        schemaVersion: 'v1',
        hostId: 'shop',
        environment: 'production',
        artifactRegistryUrl: 'https://registry.example',
      })
      .when.runtimeConfigRead();

    expect(driver.get.runtimeConfig()?.hostId).toBe('shop');
  });

  it('should fail when the runtime config responds with an error status', async () => {
    await driver.given
      .responseStatus(RUNTIME_URL, 500)
      .when.runtimeConfigRead();

    expect(driver.get.errorMessage()).toBe(
      'Atlas runtime config returned 500.',
    );
  });
});

describe('readCatalog', () => {
  let driver: HostCatalogDriver;

  beforeEach(() => {
    driver = new HostCatalogDriver();
  });

  describe('when the environment is production', () => {
    it('should load the deployed host and apps when the deployment is valid', async () => {
      await driver.given.deployment().when.catalogRead();

      expect(driver.get.catalog()).toMatchObject({
        hostId: 'shop',
        revision: 'rev-1',
        host: driver.get.hostManifest(),
        apps: [driver.get.appManifest()],
      });
    });

    it('should fail when the deployment responds with an error status', async () => {
      await driver.when.catalogRead();

      expect(driver.get.errorMessage()).toBe(
        'Atlas host manifest returned 404.',
      );
    });

    it('should fail when the deployment targets another environment', async () => {
      await driver.given
        .deployment({ environment: 'staging' })
        .when.catalogRead();

      expect(driver.get.errorMessage()).toBe(
        'Atlas host manifest returned invalid data.',
      );
    });

    it('should fail when the deployment targets another host', async () => {
      await driver.given.deployment({ hostId: 'other' }).when.catalogRead();

      expect(driver.get.errorMessage()).toBe(
        'Atlas host manifest returned invalid data.',
      );
    });
  });

  describe('when the environment is development', () => {
    it('should use the runtime snapshot when the page embeds a matching one', async () => {
      await driver.given
        .config(DEV_CONFIG)
        .given.runtimeSnapshot({
          schemaVersion: '1',
          runtime: { hostId: 'shop', environment: 'development' },
          catalog: {
            hostId: 'shop',
            host: driver.get.hostManifest(),
            apps: [],
          },
        })
        .when.catalogRead();

      expect(driver.get.catalog()?.hostId).toBe('shop');
    });

    it('should not fetch anything when the runtime snapshot is used', async () => {
      await driver.given
        .config(DEV_CONFIG)
        .given.runtimeSnapshot({
          schemaVersion: '1',
          runtime: { hostId: 'shop', environment: 'development' },
          catalog: {
            hostId: 'shop',
            host: driver.get.hostManifest(),
            apps: [],
          },
        })
        .when.catalogRead();

      expect(driver.get.fetchedUrls()).toEqual([]);
    });

    it('should fall back to the development session when the snapshot targets another host', async () => {
      await driver.given
        .config(DEV_CONFIG)
        .given.runtimeSnapshot({
          schemaVersion: '1',
          runtime: { hostId: 'other', environment: 'development' },
          catalog: { hostId: 'other', apps: [] },
        })
        .given.response(DEV_SESSION_URL, {
          catalog: { hostId: 'shop', apps: [] },
        })
        .when.catalogRead();

      expect(driver.get.fetchedUrls()).toEqual([DEV_SESSION_URL]);
    });

    it('should read the development session catalog when no snapshot exists', async () => {
      await driver.given
        .config(DEV_CONFIG)
        .given.response(DEV_SESSION_URL, {
          catalog: {
            hostId: 'shop',
            host: driver.get.hostManifest(),
            apps: [driver.get.appManifest()],
          },
        })
        .when.catalogRead();

      expect(driver.get.catalogAppVersions()).toEqual(['1.0.0']);
    });

    it('should fail when the development session url is missing', async () => {
      await driver.given
        .config({ environment: 'development' })
        .when.catalogRead();

      expect(driver.get.errorMessage()).toBe(
        'Atlas development session URL is missing.',
      );
    });

    it('should fail when the development session responds with an error status', async () => {
      await driver.given
        .config(DEV_CONFIG)
        .given.responseStatus(DEV_SESSION_URL, 503)
        .when.catalogRead();

      expect(driver.get.errorMessage()).toBe(
        'Atlas development session returned 503.',
      );
    });

    it('should fail when the development session catalog targets another host', async () => {
      await driver.given
        .config(DEV_CONFIG)
        .given.response(DEV_SESSION_URL, {
          catalog: { hostId: 'other', apps: [] },
        })
        .when.catalogRead();

      expect(driver.get.errorMessage()).toBe(
        'Atlas development session returned invalid data.',
      );
    });
  });
});
