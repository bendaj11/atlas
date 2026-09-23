/** @jest-environment jsdom */

import { ProvideAtlasAppDriver } from './provide-atlas-app.driver.js';

describe('provideAtlasApp', () => {
  let driver: ProvideAtlasAppDriver;

  beforeEach(() => {
    driver = new ProvideAtlasAppDriver();
  });

  describe('when the providers are created without a location strategy', () => {
    beforeEach(() => {
      driver.when.providersCreated();
    });

    it('should provide the manifest id as APP_ID when created', () => {
      expect(driver.get.appId()).toBe(driver.get.context().manifest.id);
    });

    it('should provide the app context when created', () => {
      expect(driver.get.injectedContext()).toBe(driver.get.context());
    });

    it('should move Angular component styles to the style target when created', () => {
      expect(driver.get.addHostMock()).toHaveBeenCalledWith(
        driver.get.styleTarget(),
      );
    });

    it('should leave LocationStrategy unprovided when no strategy is given', () => {
      expect(driver.get.injectedLocationStrategy()).toBeNull();
    });
  });

  it('should provide the given location strategy when one is passed', () => {
    const strategy = {
      path: () => '/',
      prepareExternalUrl: (internal: string) => internal,
      getState: () => undefined,
      pushState: () => undefined,
      replaceState: () => undefined,
      forward: () => undefined,
      back: () => undefined,
      historyGo: () => undefined,
      onPopState: () => undefined,
      getBaseHref: () => '/',
      ngOnDestroy: () => undefined,
    };
    driver.given.locationStrategy(strategy);

    driver.when.providersCreated();

    expect(driver.get.injectedLocationStrategy()).toBe(strategy);
  });
});
