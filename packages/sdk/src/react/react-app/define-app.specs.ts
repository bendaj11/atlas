import { DefineAppDriver } from './define-app.driver.js';

describe('defineApp', () => {
  let driver: DefineAppDriver;

  beforeEach(() => {
    driver = new DefineAppDriver();
  });

  describe('when the app is mounted', () => {
    beforeEach(async () => {
      await driver.when.mounted();
    });

    it('should create the root in the mount container when mounted', () => {
      expect(driver.get.createRootMock()).toHaveBeenCalledWith(
        driver.get.request().container,
      );
    });

    it('should call createElement with the mount request when mounted', () => {
      expect(driver.get.createElementMock()).toHaveBeenCalledWith(
        driver.get.request(),
      );
    });

    it('should render once when mounted', () => {
      expect(driver.get.renderMock()).toHaveBeenCalledTimes(1);
    });

    it('should unmount the root when the app is unmounted', async () => {
      await driver.when.unmounted();

      expect(driver.get.unmountRootMock()).toHaveBeenCalledTimes(1);
    });
  });
});
