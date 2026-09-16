/** @jest-environment node */

import { anAppManifest } from '@atlas/testkit';
import { aPublishedArtifact } from '../registry.testkit';
import { ArtifactRegistryDriver } from './artifact-registry.driver';

const ORDERS = anAppManifest({
  id: 'orders',
  channel: 'production',
  version: '1.0.0',
  buildId: 'canonical',
});
const RELEASE_1 = aPublishedArtifact(
  anAppManifest({
    id: 'orders',
    channel: 'production',
    version: '1.0.0',
    buildId: 'canonical',
  }),
);
const RELEASE_2 = aPublishedArtifact(
  anAppManifest({
    id: 'orders',
    channel: 'production',
    version: '2.0.0',
    buildId: 'canonical',
  }),
);
const PREVIEW_42 = aPublishedArtifact(
  anAppManifest({
    id: 'orders',
    channel: 'pr',
    prNumber: 42,
    buildId: 'abcdef1',
  }),
);

describe('readRegistry', () => {
  let driver: ArtifactRegistryDriver;

  beforeEach(() => {
    driver = new ArtifactRegistryDriver();
  });

  it('should fail when the registry responds with an error status', async () => {
    await driver.given.registryStatus(404).when.registryRead();

    expect(driver.get.errorMessage()).toBe('Atlas registry returned 404.');
  });

  it('should fail when the registry document has the wrong shape', async () => {
    await driver.given
      .registryResponse({ schemaVersion: '1' })
      .when.registryRead();

    expect(driver.get.errorMessage()).toBe(
      'Atlas registry returned invalid data.',
    );
  });

  it('should succeed when the registry document is valid', async () => {
    await driver.when.registryRead();

    expect(driver.get.errorMessage()).toBeUndefined();
  });
});

describe('readVersions', () => {
  let driver: ArtifactRegistryDriver;

  beforeEach(() => {
    driver = new ArtifactRegistryDriver();
  });

  it('should fail when the artifact is not registered', async () => {
    await driver.when.versionsRead(ORDERS);

    expect(driver.get.errorMessage()).toBe(
      'Artifact orders is not registered.',
    );
  });

  it('should list releases newest first when the artifact has releases', async () => {
    await driver.given
      .registeredApp(ORDERS, [RELEASE_1, RELEASE_2])
      .when.versionsRead(ORDERS);

    expect(driver.get.versionKeys()).toEqual([
      'production:2.0.0:canonical',
      'production:1.0.0:canonical',
    ]);
  });

  it('should not fetch release manifests when listing releases', async () => {
    await driver.given
      .registeredApp(ORDERS, [RELEASE_1, RELEASE_2])
      .when.versionsRead(ORDERS);

    expect(driver.get.manifestFetchCount()).toBe(0);
  });

  it('should append fetched previews when the artifact has previews', async () => {
    await driver.given
      .registeredApp(ORDERS, [RELEASE_1, PREVIEW_42])
      .when.versionsRead(ORDERS);

    expect(driver.get.versionKeys()).toEqual([
      'production:1.0.0:canonical',
      'pr:42:abcdef1',
    ]);
  });

  it('should report the preview when its manifest cannot be fetched', async () => {
    await driver.given
      .unpublishedPreview(ORDERS, PREVIEW_42)
      .when.versionsRead(ORDERS);

    expect(driver.get.versionsError()).toBe(
      'Preview 42 is unavailable: https://registry.example/apps/orders/previews/42/abcdef1/manifest.json returned 404.',
    );
  });

  it('should keep available previews when another preview is unavailable', async () => {
    await driver.given
      .unpublishedPreview(ORDERS, PREVIEW_42)
      .when.versionsRead(ORDERS);

    expect(driver.get.versionKeys()).toEqual([]);
  });
});

describe('loadVersion', () => {
  let driver: ArtifactRegistryDriver;

  beforeEach(() => {
    driver = new ArtifactRegistryDriver();
  });

  it('should fail when the version was never listed', async () => {
    await driver.when.versionLoaded('app:orders', 'production:9.9.9:canonical');

    expect(driver.get.errorMessage()).toBe(
      'Selected artifact version is unavailable.',
    );
  });

  it('should fetch the release manifest when the version was listed', async () => {
    await driver.given
      .registeredApp(ORDERS, [RELEASE_2])
      .when.versionsRead(ORDERS);

    await driver.when.versionLoaded('app:orders', 'production:2.0.0:canonical');

    expect(driver.get.loadedVersion()).toBe('2.0.0');
  });

  it('should reuse the fetched preview manifest when the preview was listed', async () => {
    await driver.given
      .registeredApp(ORDERS, [PREVIEW_42])
      .when.versionsRead(ORDERS);

    await driver.when.versionLoaded('app:orders', 'pr:42:abcdef1');

    expect(driver.get.manifestFetchCount()).toBe(1);
  });

  it('should fail when the fetched manifest does not match the listed version', async () => {
    await driver.given
      .registeredApp(ORDERS, [RELEASE_2])
      .given.fetchedManifestAt(
        RELEASE_2.path,
        anAppManifest({
          id: 'orders',
          channel: 'production',
          version: '3.0.0',
        }),
      )
      .when.versionsRead(ORDERS);
    await driver.when.versionLoaded('app:orders', 'production:2.0.0:canonical');

    expect(driver.get.errorMessage()).toBe(
      'Selected artifact manifest does not match its registry entry.',
    );
  });
});

describe('registryRootFor', () => {
  let driver: ArtifactRegistryDriver;

  beforeEach(() => {
    driver = new ArtifactRegistryDriver();
  });

  it('should strip the trailing slash when the environment is production', () => {
    driver.when.rootResolved({
      artifactRegistryUrl: 'https://registry.example/',
    });

    expect(driver.get.root()).toBe('https://registry.example');
  });

  it('should return nothing when the registry url is empty', () => {
    driver.when.rootResolved({ artifactRegistryUrl: '' });

    expect(driver.get.root()).toBeUndefined();
  });

  it('should return nothing when development serves the registry from the control server', () => {
    driver.when.rootResolved({
      environment: 'development',
      artifactRegistryUrl: 'http://localhost:4400',
      developmentSessionUrl: 'http://localhost:4400/atlas.dev-session.json',
    });

    expect(driver.get.root()).toBeUndefined();
  });

  it('should keep the registry url when development uses a separate registry', () => {
    driver.when.rootResolved({
      environment: 'development',
      artifactRegistryUrl: 'https://registry.example',
      developmentSessionUrl: 'http://localhost:4400/atlas.dev-session.json',
    });

    expect(driver.get.root()).toBe('https://registry.example');
  });
});

describe('uniqueManifests', () => {
  let driver: ArtifactRegistryDriver;

  beforeEach(() => {
    driver = new ArtifactRegistryDriver();
  });

  it('should keep one manifest per channel and version when duplicates exist', () => {
    driver.when.deduplicated([
      anAppManifest({
        id: 'orders',
        channel: 'production',
        version: '1.0.0',
      }),
      anAppManifest({
        id: 'orders',
        channel: 'production',
        version: '1.0.0',
      }),
      anAppManifest({
        id: 'orders',
        channel: 'production',
        version: '2.0.0',
      }),
    ]);

    expect(driver.get.uniqueVersions()).toEqual(['1.0.0', '2.0.0']);
  });
});
