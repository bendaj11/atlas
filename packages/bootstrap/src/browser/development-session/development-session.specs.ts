import { beforeEach, describe, expect, it } from '@jest/globals';
import { DevelopmentSessionDriver } from './development-session.driver.js';

describe('requestDevelopmentSession', () => {
  let driver: DevelopmentSessionDriver;

  beforeEach(() => {
    driver = new DevelopmentSessionDriver();
  });

  it('should skip request when Columbus bridge is absent', async () => {
    await driver.when.requested();

    expect(driver.get.result()).toBeUndefined();
  });

  it('should return document when Columbus bridge responds', async () => {
    await driver.given.matchingResponse().when.requested();

    expect(driver.get.result()).toEqual(driver.get.document());
  });

  it('should preserve production selection when Columbus bridge times out', async () => {
    await driver.given.bridgeInstalled().when.timedOut();

    expect(driver.get.result()).toBeUndefined();
  });
});
