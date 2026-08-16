import { describe, expect, it } from '@jest/globals';
import { RemoteAssetsDriver } from './remote-assets.driver.js';

describe('remote Angular component styles', () => {
  it('should mirror an owned component style into the app shadow root', () => {
    const driver = new RemoteAssetsDriver();
    driver.givenApp('orders');

    driver.whenAngularAddsComponentStyle('orders');

    expect(driver.getShadowStyleTexts()).toEqual([
      '.title[_ngcontent-orders-c0]{color:rebeccapurple}',
    ]);
  });

  it('should remove mirrored component styles when the app unmounts', () => {
    const driver = new RemoteAssetsDriver();
    driver.givenApp('orders');
    driver.whenAngularAddsComponentStyle('orders');

    driver.whenAppUnmounts();

    expect(driver.getShadowStyleTexts()).toEqual([]);
  });

  it("should not mirror another app's component style", () => {
    const driver = new RemoteAssetsDriver();
    driver.givenApp('orders');

    driver.whenAngularAddsComponentStyle('catalog');

    expect(driver.getShadowStyleTexts()).toEqual([]);
  });
});
