/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { CreateExportedWidgetDriver } from './create-exported-widget.driver.js';

describe('createExportedWidget', () => {
  let driver: CreateExportedWidgetDriver;

  beforeEach(() => {
    driver = new CreateExportedWidgetDriver();
  });

  describe('when the widget is mounted', () => {
    const count = faker.number.int({ min: 1, max: 999 });

    beforeEach(async () => {
      await driver.when.mounted({ count });
    });

    it('should render the component with the mount props when mounted', () => {
      expect(driver.get.renderedCount()).toBe(String(count));
    });

    it('should render the new props when setInputs is called', () => {
      const nextCount = count + 1;

      driver.when.inputsSet({ count: nextCount });

      expect(driver.get.renderedCount()).toBe(String(nextCount));
    });

    it('should stop rendering input updates when unmounted', async () => {
      await driver.when.unmounted();
      driver.when.inputsSet({ count: count + 1 });

      expect(driver.get.renderedCount()).toBe(String(count));
    });
  });
});
