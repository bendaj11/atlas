/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { AngularWidgetOutletControllerDriver } from './angular-widget-outlet-controller.driver.js';

describe('AngularWidgetOutletController', () => {
  let driver: AngularWidgetOutletControllerDriver;

  beforeEach(async () => {
    driver = new AngularWidgetOutletControllerDriver();

    await driver.when.angularApplicationStarted();
  });

  afterEach(() => {
    driver.when.applicationDestroyed();
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

  describe('when a widget is rendered with a loading component', () => {
    const widgetId = faker.string.uuid();
    const inputs = { count: faker.number.int() };

    beforeEach(async () => {
      await driver.when.renderedWithLoadingComponent(widgetId, inputs);
    });

    it('should resolve the widget with a loading renderer when a loading component is given', () => {
      expect(driver.get.resolverMock()).toHaveBeenCalledWith(
        widgetId,
        expect.objectContaining({ renderLoading: expect.any(Function) }),
      );
    });

    it('should remount the widget when the same widget is re-rendered without the loading component', async () => {
      await driver.when.rendered(widgetId, inputs);

      expect(driver.get.lifecycle()).toEqual([
        `mount:${widgetId}`,
        `unmount:${widgetId}`,
        `mount:${widgetId}`,
      ]);
    });
  });

  it('should not mount when a widget is rendered after destroy', async () => {
    driver.when.destroyed();

    await driver.when.rendered(faker.string.uuid(), { count: 1 });

    expect(driver.get.mountMock()).not.toHaveBeenCalled();
  });

  it('should remount when the mounted widget does not support setInputs and inputs change', async () => {
    const widgetId = faker.string.uuid();
    driver.given.setInputsUnsupported();

    await driver.when.rendered(widgetId, { count: 1 });
    await driver.when.rendered(widgetId, { count: 2 });

    expect(driver.get.mountMock()).toHaveBeenCalledTimes(2);
  });

  it('should not mount the next widget when destroyed while the previous widget unmounts', async () => {
    const widgetId = faker.string.uuid();
    await driver.when.rendered(widgetId, { count: 1 });
    driver.given.pendingUnmount();

    const rendering = driver.when.renderStarted(faker.string.uuid(), {
      count: 2,
    });
    await driver.when.unmountStarted();
    const destroying = driver.when.destroyStarted();
    driver.when.unmountReleased();
    await Promise.all([rendering, destroying]);

    expect(driver.get.mountMock()).toHaveBeenCalledTimes(1);
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
