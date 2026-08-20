import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { PublishConfigDriver } from './publish-config.driver.js';

describe('publish config', () => {
  let driver: PublishConfigDriver;

  beforeEach(async () => {
    driver = new PublishConfigDriver();
    await driver.given.isolatedProject();
  });

  afterEach(async () => {
    await driver.when.cleanup();
  });

  it('should return no config when optional default file is missing', async () => {
    await driver.when.loadDefault();

    expect(driver.get.result()).toBeUndefined();
  });

  it('should load executable config without consumer type packages', async () => {
    await driver.given.configUsingNodeTypesAndLocalImport();

    await driver.when.loadDefault();

    expect(driver.get.result()).toEqual({
      runtimeUrls: [`node:${process.version}`],
    });
  });

  it('should report missing file when explicit config is absent', async () => {
    await driver.when.loadExplicitMissing();

    expect(driver.get.errorCode()).toBe('ENOENT');
  });

  it('should reject malformed executable config', async () => {
    await driver.given.malformedConfig();

    await driver.when.loadDefaultFailure();

    expect(driver.get.errorMessage()).toContain('Expression or comma expected');
  });
});
