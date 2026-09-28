/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import {
  AngularHostUiDriver,
  TestError,
  TestLoading,
} from './angular-host-ui.driver.js';

describe('createAngularHostUiRenderers', () => {
  let driver: AngularHostUiDriver;

  beforeEach(() => {
    driver = new AngularHostUiDriver();
  });

  it('should create no renderers when no components are given', async () => {
    await driver.given.components({}).when.bootstrapped();

    expect(driver.get.renderers()).toEqual({});
  });

  describe('when a loading component is given', () => {
    beforeEach(async () => {
      await driver.given
        .components({ loadingComponent: TestLoading })
        .when.bootstrapped();

      driver.when.loadingRendered();
    });

    it('should render the loading component into the status element when loading is rendered', () => {
      expect(driver.get.loadingPresent()).toBe(true);
    });

    it('should attach the loading component view to the application when loading is rendered', () => {
      expect(driver.get.attachedViews()).toBe(2);
    });

    it('should remove the loading component when disposed', () => {
      driver.when.disposed();

      expect(driver.get.childCount()).toBe(0);
    });

    it('should detach the loading component view when disposed', () => {
      driver.when.disposed();

      expect(driver.get.attachedViews()).toBe(1);
    });
  });

  describe('when a host error component is given', () => {
    const error = new Error(faker.lorem.sentence());

    beforeEach(async () => {
      await driver.given
        .components({ hostErrorComponent: TestError })
        .when.bootstrapped();

      driver.when.hostErrorRendered(error);
    });

    it('should pass the error input to the host error component when the host error is rendered', () => {
      expect(driver.get.statusText()).toBe(error.message);
    });

    it('should call retry when the host error component retry is clicked', () => {
      driver.when.retryClicked();

      expect(driver.get.retryMock()).toHaveBeenCalledTimes(1);
    });
  });
});
