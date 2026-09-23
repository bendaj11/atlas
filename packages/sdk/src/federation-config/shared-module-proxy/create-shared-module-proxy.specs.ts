import { CreateSharedModuleProxyDriver } from './create-shared-module-proxy.driver.js';

describe('createSharedModuleProxy', () => {
  let driver: CreateSharedModuleProxyDriver;

  beforeEach(async () => {
    driver = new CreateSharedModuleProxyDriver();

    await driver.when.viteEnvironmentCreated();
  });

  it('should name the plugin for the React shared fallbacks when created', () => {
    expect(driver.get.pluginName()).toBe('atlas-react-shared-fallbacks');
  });

  it('should mark a proxy id as virtual when it is resolved', () => {
    driver.when.idResolved(driver.get.proxyId());

    expect(driver.get.resolvedId()).toBe(driver.get.resolvedProxyId());
  });

  it('should leave a foreign specifier unresolved when it is resolved', () => {
    driver.when.idResolved('react-dom/client');

    expect(driver.get.resolvedId()).toBeUndefined();
  });

  describe('when the Vite config is resolved', () => {
    beforeEach(async () => {
      await driver.when.configResolved();
    });

    it('should re-export the package entry when a shared proxy id is loaded', async () => {
      await driver.when.loaded(driver.get.resolvedProxyId());

      expect(driver.get.code()).toBe(
        `export * from ${JSON.stringify(driver.get.entryPoint())};`,
      );
    });

    it('should skip a module that is not a shared proxy id when it is loaded', async () => {
      await driver.when.loaded('\0other:module');

      expect(driver.get.code()).toBeUndefined();
    });

    it('should skip a proxy id for a specifier the project does not share when it is loaded', async () => {
      await driver.when.loaded('\0atlas:shared-proxy:%40fixture%2Funshared');

      expect(driver.get.code()).toBeUndefined();
    });
  });
});
