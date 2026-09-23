/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { DefineExportedWidgetDriver } from './define-exported-widget.driver.js';

describe('defineExportedWidget', () => {
  let driver: DefineExportedWidgetDriver;

  beforeEach(() => {
    driver = new DefineExportedWidgetDriver();
  });

  describe('when the widget is mounted', () => {
    const props = { count: faker.number.int() };

    beforeEach(async () => {
      await driver.when.mounted(props);
    });

    it('should call createElement with the mount props when mounted', () => {
      expect(driver.get.createElementMock()).toHaveBeenCalledWith(
        expect.objectContaining({ props }),
      );
    });

    it('should call createElement with the new props when setInputs is called', () => {
      const nextProps = { count: faker.number.int() };

      driver.when.inputsSet(nextProps);

      expect(driver.get.createElementMock()).toHaveBeenLastCalledWith(
        expect.objectContaining({ props: nextProps }),
      );
    });

    it('should render again when setInputs is called', () => {
      driver.when.inputsSet({ count: faker.number.int() });

      expect(driver.get.renderMock()).toHaveBeenCalledTimes(2);
    });

    it('should unmount the root when the widget is unmounted', async () => {
      await driver.when.unmounted();

      expect(driver.get.unmountRootMock()).toHaveBeenCalledTimes(1);
    });
  });
});
