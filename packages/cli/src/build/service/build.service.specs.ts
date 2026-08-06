import { beforeEach, describe, expect, it } from '@jest/globals';
import { BuildServiceDriver } from './build.service.driver.js';

describe('AtlasBuildService', () => {
  let driver: BuildServiceDriver;

  beforeEach(() => {
    driver = new BuildServiceDriver();
  });

  it('should preserve build ID when excluded source map changes', async () => {
    await driver.given.build('source-maps');

    await driver.when.buildManifest();

    expect(driver.get.observation()).toStrictEqual({
      excludedMapIsStable: true,
      includedMapChangesBuild: true,
    });
  });

  it('should infer PR identity when standard CI metadata is configured', async () => {
    await driver.given.build('pull-request');

    await driver.when.buildManifest();

    expect(driver.get.observation()).toStrictEqual({
      channel: 'pr',
      gitShaMatches: true,
      prNumberMatches: true,
      versionMatches: true,
    });
  });

  it('should use public UUID when Angular workspace name differs', async () => {
    await driver.given.build('angular-artifact');

    await driver.when.buildManifest();

    expect(driver.get.observation()).toBe(true);
  });

  it('should reject production build when registry URL is missing', async () => {
    await driver.given.build('missing-registry');

    await expect(driver.when.buildManifest()).rejects.toThrow(
      /registry-base-url.*required/,
    );
  });

  it('should return same manifest when build metadata is fixed', async () => {
    await driver.given.build('deterministic');

    await driver.when.buildManifest();

    expect(driver.get.observation()).toBe(true);
  });
});
