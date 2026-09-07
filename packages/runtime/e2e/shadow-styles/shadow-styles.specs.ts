import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ShadowStylesBrowserDriver } from './shadow-styles.driver.js';

describe('isolated app root variables', () => {
  let driver: ShadowStylesBrowserDriver;

  beforeEach(() => {
    driver = new ShadowStylesBrowserDriver();
  });
  afterEach(async () => {
    await driver.when.cleanup();
  });

  it('should retain independent colors when apps import the same library with different root overrides', async () => {
    driver.given.scenario('isolated');
    await driver.when.open();
    expect(await driver.get.colors()).toEqual([
      'rgb(0, 128, 0)',
      'rgb(255, 0, 0)',
      'rgb(0, 0, 255)',
    ]);
  });

  it('should retain document root behavior when apps explicitly use shared DOM', async () => {
    driver.given.scenario('shared');
    await driver.when.open();
    expect(await driver.get.colors()).toEqual([
      'rgb(255, 0, 0)',
      'rgb(255, 0, 0)',
      'rgb(255, 0, 0)',
    ]);
  });

  it('should reject stylesheet loading when the asset is missing', async () => {
    driver.given.scenario('missing');
    await driver.when.open();
    expect(driver.get.error()).toContain('Atlas could not load stylesheet');
  });

  it('should reject stylesheet loading when integrity does not match', async () => {
    driver.given.scenario('integrity');
    await driver.when.open();
    expect(driver.get.error()).toContain('Atlas could not load stylesheet');
  });
  it('should reject stylesheet loading when the CDN denies CORS', async () => {
    driver.given.scenario('cors');
    await driver.when.open();
    expect(driver.get.error()).toContain('Atlas could not load stylesheet');
  });
  it('should preserve relative asset URLs when library imports are adapted', async () => {
    driver.given.scenario('isolated');
    await driver.when.open();
    expect(await driver.get.assetPaths()).toEqual([
      '/theme/pixel.svg',
      '/theme/pixel.svg',
    ]);
  });

  it('should reject adaptation when an imported stylesheet denies CORS', async () => {
    driver.given.scenario('import-cors');
    await driver.when.open();
    expect(driver.get.error()).toContain('Could not load CSS import');
  });
});
