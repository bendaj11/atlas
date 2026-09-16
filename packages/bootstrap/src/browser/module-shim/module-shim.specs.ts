import { beforeEach, describe, expect, it } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { ModuleShimDriver } from './module-shim.driver.js';

describe('importModule', () => {
  let driver: ModuleShimDriver;

  beforeEach(() => {
    driver = new ModuleShimDriver();
  });

  it('should report an error when module shim is unavailable', async () => {
    await driver.given.unavailable(faker.internet.url()).when.import();

    expect(driver.get.error()).toEqual(
      new Error('Atlas could not initialize the ES module loader.'),
    );
  });

  it('should return host module when module shim is available', async () => {
    await driver.given
      .available({ mount: async () => undefined })
      .when.import();

    expect(driver.get.module()).toEqual({ mount: expect.any(Function) });
  });
});
