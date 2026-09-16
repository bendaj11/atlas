/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { act, waitFor } from '@testing-library/react';
import { ReactWidgetDriver } from './react-widget.driver.js';

describe('createReactAtlasSdk', () => {
  let driver: ReactWidgetDriver;

  beforeEach(() => {
    driver = new ReactWidgetDriver();
  });

  it('should return the same component when getWidget is called twice with the same id', () => {
    const widgetId = faker.string.uuid();

    expect(driver.get.widget(widgetId)).toBe(driver.get.widget(widgetId));
  });

  it('should throw ATLAS_APP_CONTEXT_MISSING when assetUrl is called without an app context', () => {
    expect(() => driver.get.reactSdk().assetUrl('logo.svg')).toThrow(
      expect.objectContaining({ code: 'ATLAS_APP_CONTEXT_MISSING' }),
    );
  });

  it('should resolve the asset inside the app artifact directory when created with an app context', () => {
    const artifactDirectory = `${faker.internet.url()}/${faker.system.semver()}/`;
    driver.given.remoteEntryUrl(`${artifactDirectory}remoteEntry.json`);

    expect(driver.get.reactSdk().assetUrl('logo.svg')).toBe(
      `${artifactDirectory}logo.svg`,
    );
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

  it('should surface ATLAS_WIDGET_MOUNT_FAILED to the error boundary when mounting rejects', async () => {
    driver.given.mountRejection(new Error(faker.lorem.sentence()));

    await driver.when.widgetRendered(faker.string.uuid(), { count: 1 });

    await waitFor(() =>
      expect(driver.get.errorCode()).toBe('ATLAS_WIDGET_MOUNT_FAILED'),
    );
  });
});
