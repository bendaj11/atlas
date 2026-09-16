import { beforeEach, describe, expect, it } from '@jest/globals';
import { ReactWidgetDriver } from './react-widget.driver.js';

describe('createReactAtlasSdk', () => {
  let driver: ReactWidgetDriver;

  beforeEach(() => {
    driver = new ReactWidgetDriver();
  });

  it('should expose an app-relative asset URL when an app uses the React SDK', () => {
    driver.given.appAt(
      'https://cdn.example/apps/orders/1.2.3/remoteEntry.json',
    );

    expect(driver.get.assetUrl('billboards/plane.png')).toBe(
      'https://cdn.example/apps/orders/1.2.3/billboards/plane.png',
    );
  });
});
