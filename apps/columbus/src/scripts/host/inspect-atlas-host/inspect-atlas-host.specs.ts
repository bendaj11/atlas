import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { InspectAtlasHostDriver } from './inspect-atlas-host.driver.js';

describe('Atlas host inspection', () => {
  let driver: InspectAtlasHostDriver;

  beforeEach(() => {
    driver = new InspectAtlasHostDriver();
  });
  afterEach(() => driver.dispose());

  it('should keep stored PR selection when runtime config and active manifest load', async () => {
    driver.given.localAppWithStoredPr();
    await driver.when.hostInspected();
    expect(driver.get.result().overrides?.overrides[0]?.manifest).toMatchObject(
      { channel: 'pr', buildId: 'pr-42' },
    );
  });

  it('should keep empty stored selection when runtime config and active manifest load', async () => {
    driver.given.localCatalogWithEmptyStoredSelection();
    await driver.when.hostInspected();
    expect(driver.get.result().overrides).toMatchObject({ overrides: [] });
  });

  it('should retain artifact identity when runtime error includes app id', async () => {
    driver.given.runtimeError('Unable to load Orders.', 'orders');
    await driver.when.hostInspected();
    expect(driver.get.result().runtimeErrors).toEqual([
      { artifactId: 'app:orders', message: 'Unable to load Orders.' },
    ]);
  });

  it('should list unique apps that currently have Atlas DOM containers', async () => {
    driver.given.visibleApps('orders', 'orders', 'billing');
    await driver.when.hostInspected();
    expect(driver.get.visibleAppIds()).toStrictEqual(['orders', 'billing']);
  });

  it('should retain deployed app version when runtime snapshot has production override', async () => {
    driver.given.runtimeSnapshotWithProductionOverride('1.0.0', '2.0.0');
    await driver.when.hostInspected();

    expect(driver.get.catalogAppVersion()).toBe('1.0.0');
  });

  it('should inspect runtime snapshot without deployment request when host is local', async () => {
    driver.given.developmentRuntimeSnapshot();
    await driver.when.hostInspected();

    expect(driver.get.developmentInspection()).toEqual({
      catalogAppVersion: '1.0.0',
      deploymentRequests: 0,
      registryRequests: 0,
    });
  });

  it('should inspect development session when local runtime snapshot is pending', async () => {
    driver.given.developmentSessionCatalog();
    await driver.when.hostInspected();

    expect(driver.get.developmentInspection()).toEqual({
      catalogAppVersion: '1.0.0',
      deploymentRequests: 0,
      registryRequests: 0,
    });
  });

  it('should retain selected artifacts when registry enrichment is unavailable', async () => {
    driver.given.unavailableRegistry();
    await driver.when.hostInspected();

    expect(driver.get.registryFailure()).toEqual({
      catalogAppVersion: '1.0.0',
      versionErrors: ['Atlas registry returned 404.'],
    });
  });

  it('should show preview source details when published preview is available', async () => {
    driver.given.catalogWithPublishedVersions();
    await driver.when.hostInspected();

    expect(driver.get.previewVersion()).toMatchObject({
      version: '0.0.0',
      buildId: 'abcdef123456',
      gitBranch: 'feature/preview-overrides',
      gitSha: 'abcdef123456',
      gitCommitTitle: 'Fix preview overrides',
    });
  });

  it('should load preview when published preview is selected', async () => {
    driver.given.catalogWithPublishedVersions();
    await driver.when.hostInspected();
    await driver.when.publishedPreviewLoaded();

    expect(driver.get.loadedManifestVersion()).toBe('0.0.0');
  });

  it('should retain available previews when registry contains a stale preview', async () => {
    driver.given.catalogWithStalePublishedPreview();
    await driver.when.hostInspected();

    expect(driver.get.appVersionChannels()).toEqual(['production', 'pr']);
  });

  it('should identify stale preview when registry manifest is missing', async () => {
    driver.given.catalogWithStalePublishedPreview();
    await driver.when.hostInspected();

    expect(driver.get.versionErrors()).toEqual([
      'Preview 43 is unavailable: http://localhost:4400/apps/orders/previews/43/missing-manifest.json returned 404.',
    ]);
  });

  it('should reject active host manifest when environment differs from runtime config', async () => {
    driver.given.hostDeploymentEnvironment('staging');
    await driver.when.hostInspected();
    expect(driver.get.error()).toEqual(
      expect.objectContaining({
        message: 'Atlas host manifest returned invalid data.',
      }),
    );
  });
});
