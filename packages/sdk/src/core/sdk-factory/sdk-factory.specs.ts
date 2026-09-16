import { beforeEach, expect, it } from '@jest/globals';
import { SdkFactoryDriver } from './sdk-factory.driver.js';

describe('createAtlasSdk', () => {
  let driver: SdkFactoryDriver;

  beforeEach(() => {
    driver = new SdkFactoryDriver();
  });

  it('should preserve a host-owned client when the host contract defines one', () => {
    const orders = { create: async (): Promise<void> => undefined };
    driver.given.orders(orders).when.createSdk();

    expect(driver.get.orders()).toBe(orders);
  });
});
