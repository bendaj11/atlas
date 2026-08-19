import { beforeEach, describe, expect, it } from '@jest/globals';
import { RemoteAssetsDriver } from './remote-assets.driver.js';

describe('remote assets', () => {
  let driver: RemoteAssetsDriver;

  beforeEach(() => {
    driver = new RemoteAssetsDriver();
  });

  it('should preserve artifact directory when root asset URL is rewritten', () => {
    driver.given
      .appAt(
        'orders',
        'https://s3.example/bucket/apps/orders/1.0.0/build-1/remoteEntry.json',
      )
      .when.rewritingAssetUrl('/assets/images/img.png');

    expect(driver.get.rewrittenAssetUrl()).toBe(
      'https://s3.example/bucket/apps/orders/1.0.0/build-1/assets/images/img.png',
    );
  });

  it('should resolve CSS asset URL when remote entry owns stylesheet', () => {
    driver.given
      .appAt('orders', 'http://localhost:4202/remoteEntry.json')
      .when.rewritingCss(
        '.hero{background:url(\'/assets/images/image.JPG\')} .icon{mask:url("assets/icon.svg")}',
      );

    expect(driver.get.rewrittenCss()).toBe(
      '.hero{background:url(\'http://localhost:4202/assets/images/image.JPG\')} .icon{mask:url("http://localhost:4202/assets/icon.svg")}',
    );
  });

  it('should mirror component style when Angular adds owned style', () => {
    driver.given.app('orders').when.angularAddsComponentStyle('orders');

    expect(driver.get.shadowStyleTexts()).toEqual([
      '.title[_ngcontent-orders-c0]{color:rebeccapurple}',
    ]);
  });

  it('should remove mirrored component styles when app unmounts', () => {
    driver.given
      .app('orders')
      .when.angularAddsComponentStyle('orders')
      .when.appUnmounts();

    expect(driver.get.shadowStyleTexts()).toEqual([]);
  });

  it('should not mirror component style when another app owns it', () => {
    driver.given.app('orders').when.angularAddsComponentStyle('catalog');

    expect(driver.get.shadowStyleTexts()).toEqual([]);
  });
});
