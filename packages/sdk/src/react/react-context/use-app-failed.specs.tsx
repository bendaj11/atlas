/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { UseAppFailedDriver } from './use-app-failed.driver.js';

describe('useAppFailed', () => {
  let driver: UseAppFailedDriver;

  beforeEach(() => {
    driver = new UseAppFailedDriver();
  });

  it('should call fail of the app context with the error when the returned callback is called', () => {
    const error = new Error(faker.lorem.sentence());

    driver.when.rendered();

    driver.when.appFailedReported(error);

    expect(driver.get.failMock()).toHaveBeenCalledWith(error);
  });

  it('should throw ATLAS_APP_CONTEXT_MISSING when rendered outside an Atlas app context', () => {
    driver.given.appContext(undefined);

    expect(() => driver.when.rendered()).toThrow(
      expect.objectContaining({ code: 'ATLAS_APP_CONTEXT_MISSING' }),
    );
  });
});
