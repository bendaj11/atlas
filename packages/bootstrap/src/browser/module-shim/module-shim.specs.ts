import { faker } from '@faker-js/faker';
import { ModuleShimDriver } from './module-shim.driver.js';

describe('installModuleShim', () => {
  let driver: ModuleShimDriver;

  beforeEach(() => {
    driver = new ModuleShimDriver();
  });

  it('should reject when no importShim is installed and the shim script cannot be loaded', async () => {
    await driver.when.installed();

    expect(driver.get.error()).toMatchObject({
      code: 'MODULE_LOADER_UNAVAILABLE',
      summary:
        'Atlas could not load the ES module shim from "/es-module-shims.js".',
    });
  });

  describe('when importShim is already installed', () => {
    beforeEach(async () => {
      driver.given.importShimInstalled({});
      await driver.when.installed();
    });

    it('should enable shim mode when installed', () => {
      expect(driver.get.shimOptions()).toEqual({ shimMode: true });
    });

    it('should resolve without error when installed', () => {
      expect(driver.get.error()).toBeUndefined();
    });
  });
});

describe('importModule', () => {
  let driver: ModuleShimDriver;

  beforeEach(() => {
    driver = new ModuleShimDriver();
  });

  it('should reject when no importShim is installed', async () => {
    const url = faker.internet.url();
    await driver.when.imported(url);

    expect(driver.get.error()).toMatchObject({
      code: 'MODULE_LOADER_UNAVAILABLE',
      summary: `Atlas ES module loader is not installed; cannot import "${url}".`,
    });
  });

  describe('when importShim is installed', () => {
    const module = { mount: async () => undefined };

    beforeEach(() => {
      driver.given.importShimInstalled(module);
    });

    it('should import through importShim when imported', async () => {
      const url = faker.internet.url();
      await driver.when.imported(url);

      expect(driver.get.importShimMock()).toHaveBeenCalledWith(url);
    });

    it('should return the imported host module when imported', async () => {
      await driver.when.imported(faker.internet.url());

      expect(driver.get.module()).toBe(module);
    });
  });
});
