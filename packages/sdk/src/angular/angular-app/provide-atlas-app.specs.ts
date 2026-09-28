/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
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

    it('should provide the manifest of the app context when created', () => {
      expect(driver.get.injectedContext().manifest).toBe(
        driver.get.context().manifest,
      );
    });

    it('should move Angular component styles to the style target when created', () => {
      expect(driver.get.addHostMock()).toHaveBeenCalledWith(
        driver.get.styleTarget(),
      );
    });

    it('should leave LocationStrategy unprovided when no strategy is given', () => {
      expect(driver.get.injectedLocationStrategy()).toBeNull();
    });

    it('should log the error to console.error when an error is handled', () => {
      const error = new Error(faker.lorem.sentence());

      driver.when.errorHandled(error);

      expect(driver.get.consoleErrorMock()).toHaveBeenCalledWith(
        'ERROR',
        error,
      );
    });

    it('should not call fail of the app context when an error is handled without pending readiness', () => {
      driver.when.errorHandled(new Error(faker.lorem.sentence()));

      expect(driver.get.failMock()).not.toHaveBeenCalled();
    });

    describe('when readiness is requested through the injected context', () => {
      beforeEach(() => {
        driver.when.readinessRequested();
      });

      it('should call waitUntilReady of the app context when readiness is requested', () => {
        expect(driver.get.waitUntilReadyMock()).toHaveBeenCalledTimes(1);
      });

      it('should call fail of the app context with the error when an error is handled before readiness is released', () => {
        const error = new Error(faker.lorem.sentence());

        driver.when.errorHandled(error);

        expect(driver.get.failMock()).toHaveBeenCalledWith(error);
      });

      it('should call the ready callback of the app context when readiness is released', () => {
        driver.when.readinessReleased();

        expect(driver.get.markReadyMock()).toHaveBeenCalledTimes(1);
      });

      it('should call the ready callback of the app context once when readiness is released twice', () => {
        driver.when.readinessReleased();
        driver.when.readinessReleased();

        expect(driver.get.markReadyMock()).toHaveBeenCalledTimes(1);
      });

      it('should not call fail of the app context when an error is handled after readiness is released', () => {
        driver.when.readinessReleased();
        driver.when.errorHandled(new Error(faker.lorem.sentence()));

        expect(driver.get.failMock()).not.toHaveBeenCalled();
      });
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
