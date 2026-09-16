import { aColumbusState } from '../../types/columbus-state.testkit';
import { ColumbusStateQueryDriver } from './useColumbusStateQuery.driver';

describe('useColumbusStateQuery', () => {
  let driver: ColumbusStateQueryDriver;

  beforeEach(() => {
    driver = new ColumbusStateQueryDriver();
  });

  describe('when the columbusState loads', () => {
    const columbusState = aColumbusState();

    beforeEach(() => {
      driver.given.columbusState(columbusState);
    });

    it('should expose the loaded columbusState when rendered', async () => {
      await driver.when.rendered();

      expect(driver.get.columbusState()).toBe(columbusState);
    });

    it('should load without an existing columbusState when rendered', async () => {
      await driver.when.rendered();

      expect(driver.get.loadRequests()).toEqual([false]);
    });

    it('should load with an existing columbusState when refetched', async () => {
      await driver.when.rendered();

      await driver.when.refetched();

      expect(driver.get.loadRequests()).toEqual([false, true]);
    });
  });

  describe('when the columbusState load fails', () => {
    beforeEach(() => {
      driver.given.loadFailure('No Atlas tab.');
    });

    it('should expose the failure when rendered', async () => {
      await driver.when.rendered();

      expect(driver.get.errorMessage()).toBe('No Atlas tab.');
    });

    it('should expose no columbusState when rendered', async () => {
      await driver.when.rendered();

      expect(driver.get.columbusState()).toBeUndefined();
    });
  });
});
