import { beforeEach, describe, expect, it } from '@jest/globals';
import { StaticRegistryDriver } from './static-registry.driver.js';

describe('static registry', () => {
  let driver: StaticRegistryDriver;

  beforeEach(() => {
    driver = new StaticRegistryDriver();
  });

  it('should select host client and app when both are published', async () => {
    await driver.given.registry('selected-app');

    expect(driver.get.observation()).toStrictEqual({
      catalogContainsApp: true,
      catalogKind: 'host',
      indexContainsApp: true,
    });
  });

  it('should keep provider discoverable when app has no placements', async () => {
    await driver.given.registry('provider-only');

    expect(driver.get.observation()).toStrictEqual({
      catalogApps: [],
      providerIsDiscoverable: true,
    });
  });

  it('should preserve catalog bytes when selected contents do not change', async () => {
    await driver.given.registry('stable-catalog');

    expect(driver.get.observation()).toBe(true);
  });

  it('should retain PR build in history when catalog is active', async () => {
    await driver.given.registry('pr-history');

    expect(driver.get.observation()).toStrictEqual({
      activeVersion: '1.0.0',
      hostIds: [],
      manifestCount: 2,
    });
  });

  it('should replace older PR build when artifact and PR match', async () => {
    await driver.given.registry('replace-pr');

    expect(driver.get.observation()).toStrictEqual({
      currentBuilds: ['second'],
      replacedBuilds: ['first'],
    });
  });

  it('should select previous host build when host is rolled back', async () => {
    await driver.given.registry('rollback-host');

    expect(driver.get.observation()).toStrictEqual({
      appBuildId: 'orders-three',
      deploymentExists: true,
      hostBuildId: 'one',
      selectedKind: 'host',
    });
  });

  it('should require build ID when version has multiple builds', async () => {
    await driver.given.registry('ambiguous-rollback');

    await expect(driver.when.rollback()).rejects.toThrow(/multiple builds/);
  });

  it('should preserve revision when artifact order changes', async () => {
    await driver.given.registry('artifact-order');

    expect(driver.get.observation()).toBe(true);
  });
});
