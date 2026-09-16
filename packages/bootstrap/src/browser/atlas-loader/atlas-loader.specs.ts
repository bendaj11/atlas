import { beforeEach, describe, expect, it } from '@jest/globals';
import { AtlasLoaderDriver } from './atlas-loader.driver.js';

describe('startAtlasLoader', () => {
  let driver: AtlasLoaderDriver;

  beforeEach(() => {
    driver = new AtlasLoaderDriver();
  });

  it('should mount catalog assembled from deployment artifacts when runtime is production', async () => {
    await driver.when.start();

    expect(driver.get.catalog()).toEqual(driver.get.productionCatalog());
  });

  it('should mount development session catalog when local host is running', async () => {
    await driver.given.localHostDevelopment().when.start();

    expect(driver.get.developmentStartup()).toEqual(
      driver.get.expectedDevelopmentStartup(),
    );
  });

  it('should publish resolved runtime snapshot when host is mounted', async () => {
    await driver.when.start();

    expect(driver.get.runtimeSnapshot()).toEqual({
      schemaVersion: '1',
      runtime: expect.objectContaining({ hostId: expect.any(String) }),
      catalog: driver.get.productionCatalog(),
    });
  });

  it('should reject deployment when its environment differs from runtime', async () => {
    await driver.given.invalidDeployment().when.start();

    expect(driver.get.error()).toEqual(
      new Error('Active host manifest is invalid.'),
    );
  });

  it('should reject deployment when selected host artifact is not a host', async () => {
    await driver.given.deploymentWithNonHostArtifact().when.start();

    expect(driver.get.error()).toEqual(
      new Error('Active host manifest does not select a host artifact.'),
    );
  });

  it('should bound artifact loading when deployment contains many references', async () => {
    await driver.given.deploymentWithManyArtifacts().when.start();

    expect(driver.get.maximumArtifactLoads()).toBe(6);
  });
});
