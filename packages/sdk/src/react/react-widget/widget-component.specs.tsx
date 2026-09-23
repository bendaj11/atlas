/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { act, waitFor } from '@testing-library/react';
import { WidgetComponentDriver } from './widget-component.driver.js';

describe('createWidgetComponent', () => {
  let driver: WidgetComponentDriver;

  beforeEach(() => {
    driver = new WidgetComponentDriver();
  });

  describe('when the widget component is rendered', () => {
    const widgetId = faker.string.uuid();
    const inputs = { count: faker.number.int() };

    beforeEach(async () => {
      await driver.when.widgetRendered(widgetId, inputs);
    });

    it('should mount the widget into its container with the initial inputs when rendered', () => {
      expect(driver.get.mountMock()).toHaveBeenCalledWith(
        driver.get.container(widgetId),
        inputs,
      );
    });

    it('should forward the new inputs when re-rendered with different inputs', async () => {
      const nextInputs = { count: inputs.count + 1 };

      await driver.when.widgetRerendered(widgetId, nextInputs);

      expect(driver.get.setInputsMock()).toHaveBeenCalledWith(nextInputs);
    });

    it('should not forward inputs when re-rendered with shallow-equal inputs', async () => {
      await driver.when.widgetRerendered(widgetId, { ...inputs });

      expect(driver.get.setInputsMock()).not.toHaveBeenCalled();
    });

    it('should unmount the mounted widget when the component unmounts', async () => {
      driver.when.widgetUnmounted();

      await waitFor(() =>
        expect(driver.get.unmountMock()).toHaveBeenCalledTimes(1),
      );
    });
  });

  describe('when a loading component is given', () => {
    const widgetId = faker.string.uuid();

    beforeEach(async () => {
      driver.given.loadingComponent(undefined);

      await driver.when.widgetRendered(widgetId, { count: faker.number.int() });
    });

    it('should render the loading component when the host shows loading', async () => {
      await act(() => driver.when.loadingShown());

      expect(driver.get.loadingIndicator()).not.toBeNull();
    });

    it('should remove the loading component when the host hides loading', async () => {
      const hide = await act(() => driver.when.loadingShown());

      act(() => hide());

      expect(driver.get.loadingIndicator()).toBeNull();
    });
  });

  it('should unmount the widget when the mount resolves after the component unmounted', async () => {
    driver.given.pendingMount();

    await driver.when.widgetRendered(faker.string.uuid(), { count: 1 });
    driver.when.widgetUnmounted();
    await driver.when.mountReleased();

    await waitFor(() =>
      expect(driver.get.unmountMock()).toHaveBeenCalledTimes(1),
    );
  });

  it('should keep the loading component hidden when the host hides loading after unmount', async () => {
    driver.given.loadingComponent(undefined);

    await driver.when.widgetRendered(faker.string.uuid(), { count: 1 });
    const hide = await act(() => driver.when.loadingShown());
    driver.when.widgetUnmounted();
    act(() => hide());

    expect(driver.get.loadingIndicator()).toBeNull();
  });

  it('should surface ATLAS_WIDGET_MOUNT_FAILED to the error boundary when mounting rejects', async () => {
    driver.given.mountRejection(new Error(faker.lorem.sentence()));

    await driver.when.widgetRendered(faker.string.uuid(), { count: 1 });

    await waitFor(() =>
      expect(driver.get.errorCode()).toBe('ATLAS_WIDGET_MOUNT_FAILED'),
    );
  });
});
