import { faker } from '@faker-js/faker';
import { ProxyConfigDriver } from './proxy-config.driver.js';

describe('loadAngularHostProxy', () => {
  let driver: ProxyConfigDriver;

  beforeEach(async () => {
    driver = new ProxyConfigDriver();

    await driver.given.project();
  });

  it('should return undefined when no proxy config path is given', async () => {
    driver.given.configPath(undefined);

    await driver.when.loaded();

    expect(driver.get.proxy()).toBeUndefined();
  });

  it('should reject when @angular/build is not installed in the project', async () => {
    await expect(driver.when.loaded()).rejects.toThrow(/@angular\/build/);
  });

  describe('when @angular/build resolves proxy routes', () => {
    const routes = { '/api': { target: faker.internet.url() } };

    beforeEach(async () => {
      await driver.given.angularBuildRoutes(routes);
    });

    it('should return the routes with the given origin', async () => {
      await driver.when.loaded();

      expect(driver.get.proxy()).toStrictEqual({
        origin: driver.get.origin(),
        routes,
      });
    });

    it('should load the proxy configuration from the project root', async () => {
      const configPath = `${faker.word.noun()}.json`;
      driver.given.configPath(configPath);

      await driver.when.loaded();

      expect(driver.get.loadProxyConfigurationCall()).toStrictEqual({
        root: driver.get.projectRoot(),
        configPath,
      });
    });
  });

  it('should return undefined when @angular/build resolves no routes', async () => {
    await driver.given.angularBuildRoutes(undefined);

    await driver.when.loaded();

    expect(driver.get.proxy()).toBeUndefined();
  });
});
