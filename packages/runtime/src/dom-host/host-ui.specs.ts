/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { HostUiDriver } from './host-ui.driver.js';

describe('createHostUi', () => {
  let driver: HostUiDriver;

  beforeEach(() => {
    driver = new HostUiDriver();
  });

  describe('when a status anchor is registered and default renderers are used', () => {
    beforeEach(() => {
      driver.given.statusAnchor().when.created();
    });

    it('should label the default loading status when loading is shown', () => {
      driver.when.loadingShown();

      expect(driver.get.statusLabel()).toBe('Loading application');
    });

    it('should mark the container busy when loading is shown', () => {
      driver.when.loadingShown();

      expect(driver.get.containerBusy()).toBe('true');
    });

    it('should render the default error message without diagnostic details when an error is shown', () => {
      driver.when.errorShown(
        new Error(
          `Duplicate app id "${faker.string.uuid()}". Suggested action: fix it.`,
        ),
      );

      expect(driver.get.containerText()).toBe(
        'Unable to start application. Retry',
      );
    });

    it('should use the alert role when an error is shown', () => {
      driver.when.errorShown(new Error(faker.lorem.sentence()));

      expect(driver.get.statusRole()).toBe('alert');
    });

    it('should set the container state to error when an error is shown', () => {
      driver.when.errorShown(new Error(faker.lorem.sentence()));

      expect(driver.get.containerState()).toBe('error');
    });

    it('should call retry when the default retry button is clicked', () => {
      driver.when.errorShown(new Error(faker.lorem.sentence()));

      driver.when.retryClicked();

      expect(driver.get.retryMock()).toHaveBeenCalledTimes(1);
    });

    it('should empty the container when cleared after loading was shown', () => {
      driver.when.loadingShown();

      driver.when.cleared();

      expect(driver.get.statusLabel()).toBeNull();
    });

    it('should remove the state attribute when cleared after loading was shown', () => {
      driver.when.loadingShown();

      driver.when.cleared();

      expect(driver.get.containerState()).toBeUndefined();
    });
  });

  describe('when a status anchor is registered and custom renderers are given', () => {
    beforeEach(() => {
      driver.given.statusAnchor().given.customRenderers().when.created();
    });

    it('should call the custom loading renderer with the container when loading is shown', () => {
      driver.when.loadingShown();

      expect(driver.get.renderHostLoadingMock()).toHaveBeenCalledWith(
        expect.any(HTMLElement),
      );
    });

    it('should dispose the loading renderer when an error replaces the loading state', () => {
      driver.when.loadingShown();

      driver.when.errorShown(new Error(faker.lorem.sentence()));

      expect(driver.get.disposeLoadingMock()).toHaveBeenCalledTimes(1);
    });

    it('should call the custom error renderer with the error and retry when an error is shown', () => {
      const error = new Error(faker.lorem.sentence());

      driver.when.errorShown(error);

      expect(driver.get.renderHostErrorMock()).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        error,
        driver.get.retryMock(),
      );
    });
  });

  describe('when no status anchor is registered yet', () => {
    beforeEach(() => {
      driver.when.created();
    });

    it('should render the loading status when the status anchor is registered after loading is shown', () => {
      driver.when.loadingShown();

      driver.when.statusAnchorRegistered();

      expect(driver.get.statusLabel()).toBe('Loading application');
    });

    it('should not render into the anchor when it is registered after dispose', () => {
      driver.when.loadingShown();

      driver.when.disposed();
      driver.when.statusAnchorRegistered();

      expect(driver.get.statusLabel()).toBeNull();
    });
  });

  describe('when a fallback container is given and loading is shown before any anchor renders', () => {
    beforeEach(() => {
      driver.given.fallbackContainer().when.created();

      driver.when.loadingShown();
    });

    it('should render the default loading status in the fallback container when loading is shown', () => {
      expect(driver.get.hostContainerStatusLabel()).toBe('Loading application');
    });

    it('should remove the fallback loading status when the status anchor is registered', () => {
      driver.when.statusAnchorRegistered();

      expect(driver.get.hostContainerStatusLabel()).toBeNull();
    });

    it('should keep the loading status when clear is requested until a host anchor renders', () => {
      driver.when.clearRequestedUntilHostAnchorRenders();

      expect(driver.get.hostContainerStatusLabel()).toBe('Loading application');
    });

    it('should keep the loading status when disposed while waiting for a host anchor', () => {
      driver.when.clearRequestedUntilHostAnchorRenders();

      driver.when.disposed();

      expect(driver.get.hostContainerStatusLabel()).toBe('Loading application');
    });

    it('should remove the loading status when the route outlet renders after clear was requested', () => {
      driver.when.clearRequestedUntilHostAnchorRenders();

      driver.when.routeOutletRegistered();

      expect(driver.get.hostContainerStatusLabel()).toBeNull();
    });

    it('should clear the status anchor when it renders after clear was requested', () => {
      driver.when.clearRequestedUntilHostAnchorRenders();

      driver.when.statusAnchorRegistered();

      expect(driver.get.containerState()).toBeUndefined();
    });

    it('should remove the loading status when the route outlet renders after dispose while waiting', () => {
      driver.when.clearRequestedUntilHostAnchorRenders();

      driver.when.disposed();
      driver.when.routeOutletRegistered();

      expect(driver.get.hostContainerStatusLabel()).toBeNull();
    });

    it('should remove the loading status when no host anchor renders by the next render after dispose', async () => {
      driver.when.clearRequestedUntilHostAnchorRenders();

      driver.when.disposed();
      await driver.when.nextRenderElapsed();

      expect(driver.get.hostContainerStatusLabel()).toBeNull();
    });
  });

  it('should remove the loading status when clear is requested after the route outlet rendered', () => {
    driver.given.fallbackContainer().given.routeOutlet().when.created();

    driver.when.loadingShown();
    driver.when.clearRequestedUntilHostAnchorRenders();

    expect(driver.get.hostContainerStatusLabel()).toBeNull();
  });
});
