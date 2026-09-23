/** @jest-environment jsdom */

import { CreateRoutedAppDriver } from './create-routed-app.driver.js';

describe('createRoutedApp', () => {
  let driver: CreateRoutedAppDriver;

  beforeEach(() => {
    driver = new CreateRoutedAppDriver();
  });

  describe('when the routed app is mounted', () => {
    beforeEach(async () => {
      await driver.when.mounted();
    });

    it('should call createElement with the created router when mounted', () => {
      expect(driver.get.createElementMock()).toHaveBeenCalledWith(
        driver.get.router(),
      );
    });

    describe('when unmounted', () => {
      beforeEach(async () => {
        await driver.when.unmounted();
      });

      it('should stop the router subscription when unmounted', () => {
        expect(driver.get.routerUnsubscribeMock()).toHaveBeenCalledTimes(1);
      });

      it('should dispose the router when unmounted', () => {
        expect(driver.get.routerDisposeMock()).toHaveBeenCalledTimes(1);
      });

      it('should unmount the root when unmounted', () => {
        expect(driver.get.unmountRootMock()).toHaveBeenCalledTimes(1);
      });
    });
  });
});
