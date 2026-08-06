import { beforeEach, describe, expect, it } from '@jest/globals';
import { DevelopmentConfigDriver } from './config.driver.js';

describe('development configuration', () => {
  let driver: DevelopmentConfigDriver;

  beforeEach(() => {
    driver = new DevelopmentConfigDriver();
  });

  it('should prefer original serve proxy when original target is configured', async () => {
    await driver.given.angularProject({ originalTarget: 'configured' });

    await driver.when.resolveProxyPath();

    expect(driver.get.resolvedProxyPath()).toBe(
      driver.get.configuredProxyPath(),
    );
  });

  it('should return Vite port when React dev server is configured', async () => {
    await driver.given.devServer('react');

    await driver.when.resolvePort();

    expect(driver.get.resolvedPort()).toBe(driver.get.configuredPort());
  });

  it('should return original serve port when Angular dev server is configured', async () => {
    await driver.given.devServer('angular');

    await driver.when.resolvePort();

    expect(driver.get.resolvedPort()).toBe(driver.get.configuredPort());
  });
});
