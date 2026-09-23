/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { DefineAngularAppDriver } from './define-app.driver.js';

describe('defineApp', () => {
  let driver: DefineAngularAppDriver;

  beforeEach(() => {
    driver = new DefineAngularAppDriver();
  });

  describe('when the app is mounted', () => {
    beforeEach(async () => {
      await driver.when.appMounted();
    });

    it('should call the bootstrap function with the mount request when mounted', () => {
      expect(driver.get.bootstrapAppMock()).toHaveBeenCalledWith(
        expect.objectContaining({ context: driver.get.context() }),
      );
    });

    it('should return the bootstrap unmount when the app is unmounted', async () => {
      await driver.when.unmounted();

      expect(driver.get.unmountMock()).toHaveBeenCalledTimes(1);
    });
  });
});

describe('defineExportedWidget', () => {
  let driver: DefineAngularAppDriver;

  beforeEach(() => {
    driver = new DefineAngularAppDriver();
  });

  describe('when the widget is mounted', () => {
    const props = { count: faker.number.int() };

    beforeEach(async () => {
      await driver.when.widgetMounted(props);
    });

    it('should call the bootstrap function with the widget props when mounted', () => {
      expect(driver.get.bootstrapWidgetMock()).toHaveBeenCalledWith(
        expect.objectContaining({ props }),
      );
    });

    it('should return the bootstrap unmount when the widget is unmounted', async () => {
      await driver.when.unmounted();

      expect(driver.get.unmountMock()).toHaveBeenCalledTimes(1);
    });
  });
});
