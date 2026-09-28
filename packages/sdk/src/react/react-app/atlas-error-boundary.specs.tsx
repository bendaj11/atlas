/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { AtlasErrorBoundaryDriver } from './atlas-error-boundary.driver.js';

describe('AtlasErrorBoundary', () => {
  let driver: AtlasErrorBoundaryDriver;

  beforeEach(() => {
    driver = new AtlasErrorBoundaryDriver();
  });

  it('should render the children when no child throws', () => {
    const text = faker.lorem.sentence();

    driver.given.childError(undefined).given.childText(text).when.rendered();

    expect(driver.get.text()).toBe(text);
  });

  it('should not call fail of the app context when no child throws', () => {
    driver.given.childError(undefined).when.rendered();

    expect(driver.get.failMock()).not.toHaveBeenCalled();
  });

  describe('when a child throws while rendering', () => {
    const error = new Error(faker.lorem.sentence());

    beforeEach(() => {
      driver.given
        .childError(error)
        .given.childText(faker.lorem.sentence())
        .when.rendered();
    });

    it('should call fail of the app context with the error when a child throws', () => {
      expect(driver.get.failMock()).toHaveBeenCalledWith(error);
    });

    it('should render nothing when a child throws', () => {
      expect(driver.get.text()).toBe('');
    });
  });
});
