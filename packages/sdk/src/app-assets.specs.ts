import { beforeEach, describe, expect, it } from '@jest/globals';
import { AppAssetsDriver } from './app-assets.driver.js';

describe('createAtlasAppAssetFacade', () => {
  let driver: AppAssetsDriver;

  beforeEach(() => {
    driver = new AppAssetsDriver();
  });

  it('should resolve a public asset from the app artifact directory when given an output path', () => {
    driver.given.appAt(
      'https://cdn.example/apps/orders/1.2.3/remoteEntry.json',
    );

    expect(driver.get.assetUrl('billboards/plane.png')).toBe(
      'https://cdn.example/apps/orders/1.2.3/billboards/plane.png',
    );
  });

  it('should return the app artifact directory when an app needs an asset base URL', () => {
    driver.given.appAt(
      'https://cdn.example/apps/orders/1.2.3/remoteEntry.json',
    );

    expect(driver.get.assetBaseUrl()).toBe(
      'https://cdn.example/apps/orders/1.2.3/',
    );
  });

  it('should reject a path outside the app artifact directory when an asset path escapes it', () => {
    driver.given.appAt(
      'https://cdn.example/apps/orders/1.2.3/remoteEntry.json',
    );

    expect(() => driver.get.assetUrl('../shared/plane.png')).toThrow(
      RangeError,
    );
  });
});
