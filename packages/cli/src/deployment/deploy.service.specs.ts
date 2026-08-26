import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { DeployServiceDriver } from './deploy.service.driver.js';

describe('AtlasDeployService', () => {
  let driver: DeployServiceDriver;

  beforeEach(async () => {
    driver = new DeployServiceDriver();
    await driver.given.catalog();
  });

  afterEach(() => {
    driver.when.cleanup();
  });

  it('should write selected version to environment state when exact release is deployed', async () => {
    await driver.when.deploy();

    expect(driver.get.selectedAppVersion()).toBe('1.4.0');
  });

  it('should generate descriptor-only active manifest when release is deployed', async () => {
    await driver.when.deploy();

    expect(driver.get.activeManifest().apps[0]).not.toHaveProperty('url');
  });

  it('should resolve latest from source artifact catalog when latest is selected', async () => {
    driver.given.latest();

    await driver.when.deploy();

    expect(driver.get.result()?.version).toBe('1.4.0');
  });

  it('should resolve selected source environment version when environment is selected', async () => {
    await driver.given.sourceEnvironment();

    await driver.when.deploy();

    expect(driver.get.selectedAppVersion()).toBe('1.4.0');
  });

  it('should not copy artifacts to target when source and target registries differ', async () => {
    await driver.given.separateRegistries();

    await driver.when.deploy();

    expect(driver.get.targetArtifactPaths()).toEqual([]);
  });

  it('should reject mixed registry shorthand and explicit flags when both are supplied', async () => {
    driver.given.conflictingFlags();

    await expect(driver.get.deployError()).resolves.toEqual(
      expect.objectContaining({
        message: expect.stringContaining('cannot be combined'),
      }),
    );
  });

  it('should not invalidate registry paths when deployment is a dry run', async () => {
    driver.given.dryRun();

    await driver.when.deploy();

    expect(driver.get.invalidations()).toEqual([]);
  });

  it('should retain target environment selections when deployment is a dry run', async () => {
    driver.given.dryRun();

    await driver.when.deploy();

    expect(driver.get.selectedAppVersion()).toBeUndefined();
  });

  it('should reject malformed target environment state when deployment reads it', async () => {
    await driver.given.malformedTargetState();

    await expect(driver.get.deployError()).resolves.toEqual(
      expect.objectContaining({
        message: expect.stringContaining('deployment state is invalid'),
      }),
    );
  });

  it('should reject insecure registry URL when registry is not loopback', async () => {
    driver.given.insecureRegistry();

    await expect(driver.get.deployError()).resolves.toEqual(
      expect.objectContaining({
        message: expect.stringContaining('must use HTTPS'),
      }),
    );
  });
});
