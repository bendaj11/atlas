import { beforeEach, describe, expect, it } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { HostLoaderDriver } from './host-loader.driver.js';

describe('loadHostModule', () => {
  let driver: HostLoaderDriver;

  beforeEach(() => {
    driver = new HostLoaderDriver();
  });

  it('should return imported host module when selected expose is available', async () => {
    await driver.given
      .availableExpose('./' + faker.system.commonFileName('js'))
      .when.load();

    expect(driver.get.module()).toEqual({ mount: expect.any(Function) });
  });

  it('should append host styles when the manifest declares them', async () => {
    await driver.given
      .hostWithStyles('./' + faker.system.commonFileName('js'))
      .when.load();

    expect(driver.get.stylesheetUrls()).toHaveLength(1);
  });

  it('should reject host metadata when selected expose is missing', async () => {
    await driver.given
      .missingExpose('./' + faker.system.commonFileName('js'))
      .when.load();

    expect(driver.get.error()).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('does not expose'),
      }),
    );
  });

  it('should reject host metadata when shared dependency is invalid', async () => {
    await driver.given
      .invalidSharedDependency('./' + faker.system.commonFileName('js'))
      .when.load();

    expect(driver.get.error()).toEqual(
      new Error(
        'Selected host remote contains invalid shared dependency metadata.',
      ),
    );
  });

  it('should reload host when a federation rebuild completes', async () => {
    await driver.given
      .hostWithBuildNotifications('./' + faker.system.commonFileName('js'))
      .when.reloadAfterBuild();

    expect(driver.get.reloadCount()).toBe(1);
  });
});
