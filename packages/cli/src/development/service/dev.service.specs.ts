import { beforeEach, describe, expect, it } from '@jest/globals';
import { DevServiceDriver } from './dev.service.driver.js';

describe('AtlasDevService', () => {
  let driver: DevServiceDriver;

  beforeEach(() => {
    driver = new DevServiceDriver();
  });

  it('should prepare host override without spawning when host is prepare-only', async () => {
    await driver.given.project('host-prepare');

    await driver.when.prepare();

    expect(driver.get.observation()).toStrictEqual(
      driver.get.hostPreparation(),
    );
  });

  it('should target localhost when host previews are empty', async () => {
    await driver.given.project('host-prepare');

    await driver.when.prepare();

    expect(driver.get.previewUrl()).toBe(driver.get.localHostUrl());
  });

  it('should prepare app override without spawning when app is prepare-only', async () => {
    await driver.given.project('app-prepare');

    await driver.when.prepare();

    expect(driver.get.observation()).toStrictEqual(driver.get.appPreparation());
  });

  it('should target package preview when deployed host is prepare-only', async () => {
    await driver.given.project('host-deployed-prepare');

    await driver.when.prepare();

    expect(driver.get.previewUrl()).toBe(driver.get.hostUrl());
  });

  it('should reject removed host URL option when development starts', async () => {
    await driver.given.project('host-url-removed');

    await driver.when.prepareRejected();

    expect(driver.get.errorMessage()).toBe(
      '--host-url is not supported by atlas dev. Define package.json atlas.previews instead.',
    );
  });

  it('should reject local host preview when bootstrap port differs', async () => {
    await driver.given.project('host-local-port-mismatch');

    await driver.when.prepareRejected();

    expect(driver.get.errorMessage()).toContain(
      'must use http and configured bootstrap port',
    );
  });
});
