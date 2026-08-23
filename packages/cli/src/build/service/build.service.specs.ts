import { beforeEach, describe, expect, it } from '@jest/globals';
import { BuildServiceDriver } from './build.service.driver.js';

describe('AtlasBuildService', () => {
  let driver: BuildServiceDriver;

  beforeEach(() => {
    driver = new BuildServiceDriver();
  });

  it('should change build ID when source map changes', async () => {
    await driver.given.build('source-maps');

    await driver.when.buildManifest();

    expect(driver.get.observation()).toBe(true);
  });

  it('should include framework-emitted source maps in publication', async () => {
    await driver.given.build('source-maps');

    const result = await driver.when.publishVersion('1.2.3');

    expect(result.files).toContain('remoteEntry.js.map');
  });

  it('should use public UUID when Angular workspace name differs', async () => {
    await driver.given.build('angular-artifact');

    await driver.when.buildManifest();

    expect(driver.get.observation()).toBe(true);
  });

  it('should return same manifest when build metadata is fixed', async () => {
    await driver.given.build('deterministic');

    await driver.when.buildManifest();

    expect(driver.get.observation()).toBe(true);
  });

  it('should include Angular styles in a local host manifest', async () => {
    await driver.given.build('local-host-styles');

    await driver.when.buildManifest();

    expect(driver.get.observation()).toBe(true);
  });

  it('should reject release publication when version is not a safe segment', async () => {
    await driver.given.build('deterministic');

    await expect(
      driver.when.publishVersion('release candidate'),
    ).rejects.toThrow(/release version/i);
  });
});
