import { beforeEach, describe, expect, it } from '@jest/globals';
import { AssetUrlDriver } from './asset-url.driver.js';

describe('remote asset URL resolver', () => {
  let driver: AssetUrlDriver;

  beforeEach(() => {
    driver = new AssetUrlDriver();
  });

  it('should preserve remote artifact directory when root asset path is resolved', () => {
    driver.given
      .manifestAt(
        'https://s3.example/bucket/apps/orders/1.0.0/build-1/remoteEntry.json',
      )
      .when.resolvingUrl('/assets/images/img.png');

    expect(driver.get.resolvedUrl()).toBe(
      'https://s3.example/bucket/apps/orders/1.0.0/build-1/assets/images/img.png',
    );
  });

  it('should preserve external URL when external URL is resolved', () => {
    driver.given
      .manifestAt('https://cdn.example/orders/remoteEntry.json')
      .when.resolvingUrl('https://other.example/image.png');

    expect(driver.get.resolvedUrl()).toBe('https://other.example/image.png');
  });

  it('should resolve relative asset URL when remote entry includes directory', () => {
    driver.given
      .manifestAt('http://localhost:4202/apps/catalog/remoteEntry.json')
      .when.resolvingUrl('assets/images/image.JPG');

    expect(driver.get.resolvedUrl()).toBe(
      'http://localhost:4202/apps/catalog/assets/images/image.JPG',
    );
  });

  it('should preserve fragment URL when fragment URL is resolved', () => {
    driver.given
      .manifestAt('https://cdn.example/orders/remoteEntry.json')
      .when.resolvingUrl('#icon');

    expect(driver.get.resolvedUrl()).toBe('#icon');
  });

  it('should rewrite quoted CSS asset URLs when CSS contains asset references', () => {
    driver.given
      .manifestAt('http://localhost:4202/remoteEntry.json')
      .when.rewritingCss(
        '.hero{background:url(\'/assets/images/image.JPG\')} .icon{mask:url("assets/icon.svg")}',
      );

    expect(driver.get.rewrittenCss()).toBe(
      '.hero{background:url(\'http://localhost:4202/assets/images/image.JPG\')} .icon{mask:url("http://localhost:4202/assets/icon.svg")}',
    );
  });
});
