/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { HostUiDriver } from './host-ui.driver.js';

describe('createHostUi', () => {
  let driver: HostUiDriver;

  beforeEach(() => {
    driver = new HostUiDriver();
  });

  describe('when a status anchor is registered and the default renderer is used', () => {
    beforeEach(() => {
      driver.given.statusAnchor().when.created();
    });

    it('should render the default error message without diagnostic details when an error is shown', () => {
      driver.when.errorShown(
        new Error(
          `Duplicate app id "${faker.string.uuid()}". Suggested action: fix it.`,
        ),
      );

      expect(driver.get.anchorStatus()?.textContent).toBe(
        'Unable to start application. Retry',
      );
    });

    it('should use the alert role for the default error when an error is shown', () => {
      driver.when.errorShown(new Error(faker.lorem.sentence()));

      expect(
        driver.get.anchorStatus()?.firstElementChild?.getAttribute('role'),
      ).toBe('alert');
    });

    it('should set the error state on the atlas status element when an error is shown', () => {
      driver.when.errorShown(new Error(faker.lorem.sentence()));

      expect(driver.get.anchorStatus()?.dataset.atlasState).toBe('error');
    });

    it('should call retry when the default retry button is clicked', () => {
      driver.when.errorShown(new Error(faker.lorem.sentence()));

      driver.when.retryClicked();

      expect(driver.get.retryMock()).toHaveBeenCalledTimes(1);
    });

    it('should remove the atlas status element when cleared', () => {
      driver.when.errorShown(new Error(faker.lorem.sentence()));

      driver.when.cleared();

      expect(driver.get.anchorStatus()).toBeNull();
    });
  });

  it('should keep the existing children of the status anchor when an error is shown', () => {
    const child = document.createElement('span');
    driver.given.statusAnchorChild(child).given.statusAnchor().when.created();

    driver.when.errorShown(new Error(faker.lorem.sentence()));

    expect(child.parentElement).toBe(driver.get.statusAnchor());
  });

  describe('when a status anchor is registered and a custom renderer is given', () => {
    beforeEach(() => {
      driver.given.statusAnchor().given.customRenderer().when.created();
    });

    it('should call the custom error renderer with the atlas status element, the error and retry when an error is shown', () => {
      const error = new Error(faker.lorem.sentence());

      driver.when.errorShown(error);

      expect(driver.get.renderHostErrorMock()).toHaveBeenCalledWith(
        driver.get.anchorStatus(),
        error,
        driver.get.retryMock(),
      );
    });

    it('should dispose the custom error renderer when cleared', () => {
      driver.when.errorShown(new Error(faker.lorem.sentence()));

      driver.when.cleared();

      expect(driver.get.disposeErrorMock()).toHaveBeenCalledTimes(1);
    });
  });

  describe('when no status anchor is registered yet', () => {
    beforeEach(() => {
      driver.when.created();
    });

    it('should render the error in the status anchor when it is registered after the error is shown', () => {
      driver.when.errorShown(new Error(faker.lorem.sentence()));

      driver.when.statusAnchorRegistered();

      expect(driver.get.anchorStatus()?.textContent).toBe(
        'Unable to start application. Retry',
      );
    });

    it('should not render into the status anchor when it is registered after clear', () => {
      driver.when.errorShown(new Error(faker.lorem.sentence()));

      driver.when.cleared();
      driver.when.statusAnchorRegistered();

      expect(driver.get.anchorStatus()).toBeNull();
    });
  });

  describe('when a fallback container with content is given and an error is shown before any anchor renders', () => {
    beforeEach(() => {
      driver.given
        .fallbackContainer()
        .given.fallbackContainerChild(document.createElement('span'))
        .when.created();

      driver.when.errorShown(new Error(faker.lorem.sentence()));
    });

    it('should render the error as the first child of the fallback container when an error is shown', () => {
      expect(driver.get.hostContainer().firstElementChild).toBe(
        driver.get.fallbackStatus(),
      );
    });

    it('should move the error out of the fallback container when the status anchor is registered', () => {
      driver.when.statusAnchorRegistered();

      expect(driver.get.fallbackStatus()).toBeNull();
    });

    it('should move the error into the status anchor when the status anchor is registered', () => {
      driver.when.statusAnchorRegistered();

      expect(driver.get.anchorStatus()?.textContent).toBe(
        'Unable to start application. Retry',
      );
    });

    it('should remove the error from the fallback container when cleared', () => {
      driver.when.cleared();

      expect(driver.get.fallbackStatus()).toBeNull();
    });
  });
});
