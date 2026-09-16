import { faker } from '@faker-js/faker';
import { ReactAppDriver } from './react-app.driver.js';

describe('defineApp', () => {
  let driver: ReactAppDriver;

  beforeEach(() => {
    driver = new ReactAppDriver();
  });

  describe('when the app is mounted', () => {
    beforeEach(async () => {
      await driver.when.appMounted();
    });

    it('should create the root in the mount container when mounted', () => {
      expect(driver.get.createRootMock()).toHaveBeenCalledWith(
        driver.get.container(),
      );
    });

    it('should call createElement with the mount request when mounted', () => {
      expect(driver.get.createElementMock()).toHaveBeenCalledWith(
        expect.objectContaining({ context: driver.get.context() }),
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

describe('createRoutedApp', () => {
  let driver: ReactAppDriver;

  beforeEach(() => {
    driver = new ReactAppDriver();
  });

  describe('when the routed app is mounted and unmounted', () => {
    beforeEach(async () => {
      await driver.when.routedAppMounted();

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

describe('defineExportedWidget', () => {
  let driver: ReactAppDriver;

  beforeEach(() => {
    driver = new ReactAppDriver();
  });

  describe('when the widget is mounted', () => {
    const props = { count: faker.number.int() };

    beforeEach(async () => {
      await driver.when.widgetMounted(props);
    });

    it('should call createElement with the mount props when mounted', () => {
      expect(driver.get.createWidgetElementMock()).toHaveBeenCalledWith(
        expect.objectContaining({ props }),
      );
    });

    it('should call createElement with the new props when setInputs is called', () => {
      const nextProps = { count: faker.number.int() };

      driver.when.widgetInputsSet(nextProps);

      expect(driver.get.createWidgetElementMock()).toHaveBeenLastCalledWith(
        expect.objectContaining({ props: nextProps }),
      );
    });

    it('should render again when setInputs is called', () => {
      driver.when.widgetInputsSet({ count: faker.number.int() });

      expect(driver.get.renderMock()).toHaveBeenCalledTimes(2);
    });

    it('should unmount the root when the widget is unmounted', async () => {
      await driver.when.unmounted();

      expect(driver.get.unmountRootMock()).toHaveBeenCalledTimes(1);
    });
  });
});
