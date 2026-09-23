/** @jest-environment jsdom */

import { RemoteAssetsDriver } from './remote-assets.driver.js';

const ORDERS_REMOTE_ENTRY_URL = 'http://localhost:4201/remoteEntry.json';
const CATALOG_REMOTE_ENTRY_URL = 'http://localhost:4202/remoteEntry.json';

describe('rewriteAssetUrl', () => {
  let driver: RemoteAssetsDriver;

  beforeEach(() => {
    driver = new RemoteAssetsDriver();
  });

  it('should resolve a root asset path against the artifact directory when the remote entry is nested', () => {
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

  it('should leave an absolute url unchanged when the value already has a protocol', () => {
    driver.given
      .appAt('orders', ORDERS_REMOTE_ENTRY_URL)
      .when.rewritingAssetUrl('https://cdn.example/x.png');

    expect(driver.get.rewrittenAssetUrl()).toBe('https://cdn.example/x.png');
  });
});

describe('rewriteCssAssetUrls', () => {
  let driver: RemoteAssetsDriver;

  beforeEach(() => {
    driver = new RemoteAssetsDriver();
  });

  it('should resolve quoted and unquoted asset urls when the css references assets', () => {
    driver.given
      .appAt('orders', ORDERS_REMOTE_ENTRY_URL)
      .when.rewritingCss(
        '.hero{background:url(\'/assets/images/image.JPG\')} .icon{mask:url("assets/icon.svg")}',
      );

    expect(driver.get.rewrittenCss()).toBe(
      '.hero{background:url(\'http://localhost:4201/assets/images/image.JPG\')} .icon{mask:url("http://localhost:4201/assets/icon.svg")}',
    );
  });
});

describe('startRemoteAssetRewrite', () => {
  let driver: RemoteAssetsDriver;

  beforeEach(() => {
    driver = new RemoteAssetsDriver();
  });

  describe('when one Angular app is mounted', () => {
    beforeEach(() => {
      driver.given.appAt('orders', ORDERS_REMOTE_ENTRY_URL);
    });

    it('should resolve asset urls in an owned document style when Angular adds it', () => {
      driver.when.documentStyleAdded(
        ".aaa[_ngcontent-orders-c0]{background:url('/assets/photo.png')}",
      );

      expect(driver.get.addedStyleTexts()[0]).toBe(
        ".aaa[_ngcontent-orders-c0]{background:url('http://localhost:4201/assets/photo.png')}",
      );
    });

    it('should mirror an owned document style into the shadow root when Angular adds it', () => {
      driver.when.documentStyleAdded(
        '.title[_ngcontent-orders-c0]{color:rebeccapurple}',
      );

      expect(driver.get.shadowStyleTexts('orders')).toEqual([
        '.title[_ngcontent-orders-c0]{color:rebeccapurple}',
      ]);
    });

    it('should remove mirrored styles when the app unmounts', () => {
      driver.when.documentStyleAdded(
        '.title[_ngcontent-orders-c0]{color:rebeccapurple}',
      );

      driver.when.appUnmounted('orders');

      expect(driver.get.shadowStyleTexts('orders')).toEqual([]);
    });

    it('should leave a document style unchanged when another app owns it', () => {
      driver.when.documentStyleAdded(
        ".aaa[_ngcontent-catalog-c0]{background:url('/assets/photo.png')}",
      );

      expect(driver.get.addedStyleTexts()[0]).toBe(
        ".aaa[_ngcontent-catalog-c0]{background:url('/assets/photo.png')}",
      );
    });

    it('should resolve asset urls in a nested style when a document fragment is added to the head', () => {
      driver.when.documentFragmentWithStyleAdded(
        ".aaa[_ngcontent-orders-c0]{background:url('/assets/photo.png')}",
      );

      expect(driver.get.addedStyleTexts()[0]).toBe(
        ".aaa[_ngcontent-orders-c0]{background:url('http://localhost:4201/assets/photo.png')}",
      );
    });

    it('should resolve asset urls in a style added inside the boundary when the style references assets', () => {
      driver.when.boundaryStyleAdded(
        'orders',
        ".aaa{background:url('/assets/photo.png')}",
      );

      expect(driver.get.addedStyleTexts()[0]).toBe(
        ".aaa{background:url('http://localhost:4201/assets/photo.png')}",
      );
    });

    it('should resolve the image src when a wrapper with an image is appended to the boundary', () => {
      driver.when.boundaryImageAppended('orders', '/assets/images/image.jpg');

      expect(driver.get.appendedImageSrc()).toBe(
        'http://localhost:4201/assets/images/image.jpg',
      );
    });

    it('should leave descendant insertion methods unpatched when the app unmounts', () => {
      driver.when.boundaryImageAppended('orders', '/assets/images/image.jpg');

      driver.when.appUnmounted('orders');

      expect(driver.get.boundaryChildAppend('orders')).toBe(
        Element.prototype.append,
      );
    });
  });

  describe('when two Angular apps are mounted', () => {
    beforeEach(() => {
      driver.given
        .appAt('orders', ORDERS_REMOTE_ENTRY_URL)
        .given.appAt('catalog', CATALOG_REMOTE_ENTRY_URL);
    });

    it('should resolve each owned document style against its own remote origin when both apps add styles', () => {
      driver.when.documentStyleAdded(
        ".aaa[_ngcontent-orders-c0]{background:url('/assets/photo.png')}",
      );
      driver.when.documentStyleAdded(
        ".aaa[_ngcontent-catalog-c0]{background:url('/assets/photo.png')}",
      );

      expect(driver.get.addedStyleTexts()).toEqual([
        ".aaa[_ngcontent-orders-c0]{background:url('http://localhost:4201/assets/photo.png')}",
        ".aaa[_ngcontent-catalog-c0]{background:url('http://localhost:4202/assets/photo.png')}",
      ]);
    });

    it('should keep rewriting for the remaining app when the first app is released twice', () => {
      driver.when.appUnmounted('orders');
      driver.when.appUnmounted('orders');
      driver.when.documentStyleAdded(
        ".aaa[_ngcontent-catalog-c0]{background:url('/assets/photo.png')}",
      );

      expect(driver.get.addedStyleTexts()[0]).toBe(
        ".aaa[_ngcontent-catalog-c0]{background:url('http://localhost:4202/assets/photo.png')}",
      );
    });
  });

  it('should attribute a style to the app whose id matches exactly when app ids share a prefix', () => {
    driver.given
      .appAt('orders', ORDERS_REMOTE_ENTRY_URL)
      .given.appAt('orders-admin', CATALOG_REMOTE_ENTRY_URL);
    driver.when.documentStyleAdded(
      ".aaa[_ngcontent-orders-admin-c0]{background:url('/assets/photo.png')}",
    );

    expect(driver.get.addedStyleTexts()[0]).toBe(
      ".aaa[_ngcontent-orders-admin-c0]{background:url('http://localhost:4202/assets/photo.png')}",
    );
  });
});
