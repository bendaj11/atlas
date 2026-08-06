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

  it('should prepare app override without spawning when app is prepare-only', async () => {
    await driver.given.project('app-prepare');

    await driver.when.prepare();

    expect(driver.get.observation()).toStrictEqual(driver.get.appPreparation());
  });
});
