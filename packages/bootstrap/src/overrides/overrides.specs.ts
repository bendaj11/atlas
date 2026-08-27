import { beforeEach, describe, expect, it } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { OverridesDriver } from './overrides.driver.js';

describe('applyOverrides', () => {
  let driver: OverridesDriver;

  beforeEach(() => {
    driver = new OverridesDriver();
  });

  it('should preserve catalog when no stored override exists', async () => {
    await driver.given.noStoredOverride(undefined).when.apply();

    expect(driver.get.result()).toBeDefined();
  });

  it('should preserve catalog when stored override targets another host', async () => {
    await driver.given.overrideForAnotherHost(faker.string.uuid()).when.apply();

    expect(driver.get.result()).toBeDefined();
  });

  it('should reject stored override when app manifest is missing', async () => {
    await driver.given
      .invalidAppOverride({ hostId: driver.get.hostId(), apps: [{}] })
      .when.apply();

    expect(driver.get.error()).toEqual(
      new Error('Atlas app override is invalid.'),
    );
  });

  it('should add local app when production catalog does not select it', async () => {
    await driver.given.newLocalAppOverride().when.apply();

    expect(driver.get.resultAppIds()).toEqual(['new-app']);
  });
});
