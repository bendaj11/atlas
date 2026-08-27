import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { DevelopmentSessionDriver } from './development-session.driver.js';

describe('development session bridge', () => {
  let driver: DevelopmentSessionDriver;

  beforeEach(() => {
    driver = new DevelopmentSessionDriver();
  });

  afterEach(() => driver.dispose());

  it('should return development document when Columbus provides one', async () => {
    await driver.when.requested();

    expect(driver.get.result()).toEqual(driver.get.document());
  });

  it('should continue without delay when local control server is unavailable', async () => {
    driver.given.unavailableControlServer();

    await driver.when.requested();

    expect(driver.get.result()).toBeUndefined();
  });
});
