import { faker } from '@faker-js/faker';
import { aColumbusState } from '../../testkit/columbus-state.testkit';
import { ColumbusStateQueryDriver } from './useColumbusStateQuery.driver';

describe('useColumbusStateQuery', () => {
  let driver: ColumbusStateQueryDriver;

  beforeEach(() => {
    driver = new ColumbusStateQueryDriver();
  });

  describe('when the columbusState loads', () => {
    const columbusState = aColumbusState();

    beforeEach(() => driver.given.columbusState(columbusState).when.rendered());

    it('should return the loaded columbusState as data when rendered', () => {
      expect(driver.get.result().data).toBe(columbusState);
    });

    it('should call loadColumbusState without an existing columbusState when rendered', () => {
      expect(driver.get.loadColumbusState()).toHaveBeenCalledWith(false);
    });

    it('should call loadColumbusState with an existing columbusState when refetched', async () => {
      await driver.when.refetched();

      expect(driver.get.loadColumbusState()).toHaveBeenLastCalledWith(true);
    });
  });

  describe('when the columbusState load fails', () => {
    const error = new Error(faker.lorem.sentence());

    beforeEach(() => driver.given.loadFailure(error).when.rendered());

    it('should return the load error when rendered', () => {
      expect(driver.get.result().error).toBe(error);
    });

    it('should return no data when rendered', () => {
      expect(driver.get.result().data).toBeUndefined();
    });
  });
});
