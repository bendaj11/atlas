import { faker } from '@faker-js/faker';
import { AngularWidgetDriver } from './angular-widget.driver.js';

describe('createAngularAtlasSdk', () => {
  let driver: AngularWidgetDriver;

  beforeEach(() => {
    driver = new AngularWidgetDriver();
  });

  it('should return a frozen binding with widget id and inputs when getWidget is called', () => {
    const widgetId = faker.string.uuid();
    const inputs = { count: faker.number.int() };

    const binding = driver.get.binding(widgetId, inputs);

    expect({ binding, frozen: Object.isFrozen(binding) }).toEqual({
      binding: { widgetId, inputs },
      frozen: true,
    });
  });
});

describe('AngularWidgetOutletController', () => {
  let driver: AngularWidgetDriver;

  beforeEach(() => {
    driver = new AngularWidgetDriver();
  });

  it('should report ATLAS_WIDGET_BINDING_INVALID to the error handler when rendering a binding not created by getWidget', async () => {
    await driver.when
      .foreignBindingRendered(faker.string.uuid())
      .catch(() => undefined);

    expect(driver.get.handleErrorMock()).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ATLAS_WIDGET_BINDING_INVALID' }),
    );
  });

  describe('when a widget is rendered', () => {
    const widgetId = faker.string.uuid();
    const inputs = { count: faker.number.int() };

    beforeEach(async () => {
      await driver.when.rendered(widgetId, inputs);
    });

    it('should mount the widget once with its inputs when rendered', () => {
      expect(driver.get.mountMock()).toHaveBeenCalledWith(
        expect.anything(),
        inputs,
      );
    });

    it('should forward new inputs without remounting when the same widget is rendered with other inputs', async () => {
      const nextInputs = { count: inputs.count + 1 };

      await driver.when.rendered(widgetId, nextInputs);

      expect(driver.get.setInputsMock()).toHaveBeenLastCalledWith(nextInputs);
    });

    it('should keep one mount when the same widget is rendered with other inputs', async () => {
      await driver.when.rendered(widgetId, { count: inputs.count + 1 });

      expect(driver.get.mountMock()).toHaveBeenCalledTimes(1);
    });

    it('should unmount the previous widget before mounting the next when a different widget is rendered', async () => {
      const nextWidgetId = faker.string.uuid();

      await driver.when.rendered(nextWidgetId, inputs);

      expect(driver.get.lifecycle()).toEqual([
        `mount:${widgetId}`,
        `unmount:${widgetId}`,
        `mount:${nextWidgetId}`,
      ]);
    });

    it('should unmount the widget when destroyed', async () => {
      await driver.when.destroyed();

      expect(driver.get.lifecycle()).toEqual([
        `mount:${widgetId}`,
        `unmount:${widgetId}`,
      ]);
    });
  });

  it('should remount when the mounted widget does not support setInputs and inputs change', async () => {
    const widgetId = faker.string.uuid();
    driver.given.setInputsUnsupported();

    await driver.when.rendered(widgetId, { count: 1 });
    await driver.when.rendered(widgetId, { count: 2 });

    expect(driver.get.mountMock()).toHaveBeenCalledTimes(2);
  });

  it('should unmount a widget that finishes mounting after destroy when destroyed mid-mount', async () => {
    const widgetId = faker.string.uuid();
    driver.given.pendingMount();

    const rendering = driver.when.renderStarted(widgetId, { count: 1 });
    await driver.when.mountStarted();
    const destroying = driver.when.destroyStarted();
    driver.when.mountReleased();
    await Promise.all([rendering, destroying]);

    expect(driver.get.lifecycle()).toEqual([
      `mount:${widgetId}`,
      `unmount:${widgetId}`,
    ]);
  });
});
