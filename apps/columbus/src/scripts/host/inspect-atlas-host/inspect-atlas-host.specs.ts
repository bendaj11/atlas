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
