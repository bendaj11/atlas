import { faker } from '@faker-js/faker';
import { aColumbusState } from '../../types/app.testkit';
import { UsePersistOverridesMutationDriver } from './usePersistOverridesMutation.driver';

describe('usePersistOverridesMutation', () => {
  let driver: UsePersistOverridesMutationDriver;

  beforeEach(() => {
    driver = new UsePersistOverridesMutationDriver();
  });

  describe('when rendered', () => {
    beforeEach(() => {
      driver.when.rendered();
    });

    it('should return isPending of false when rendered', () => {
      expect(driver.get.result().isPending).toBe(false);
    });

    it('should call setColumbusState with the columbusState when mutated', async () => {
      const columbusState = aColumbusState();

      await driver.when.mutated(columbusState);

      expect(driver.get.setColumbusState()).toHaveBeenCalledWith(columbusState);
    });

    it('should call persistOverrides with the columbusState when mutated', async () => {
      const columbusState = aColumbusState();

      await driver.when.mutated(columbusState);

      expect(driver.get.persistOverrides()).toHaveBeenCalledWith(columbusState);
    });

    it('should call window.close once when persisting succeeds', async () => {
      await driver.when.mutated(aColumbusState());

      expect(driver.get.closeWindow()).toHaveBeenCalledTimes(1);
    });
  });

  it('should return isPending of true when persisting is pending', async () => {
    driver.given.persistPending().when.rendered();

    await driver.when.mutationStarted(aColumbusState());

    expect(driver.get.result().isPending).toBe(true);
  });

  it('should return isPending of true from another hook instance when persisting is pending', async () => {
    driver.given.persistPending().when.rendered();

    driver.when.renderedAgain();
    await driver.when.mutationStarted(aColumbusState());

    expect(driver.get.otherResult().isPending).toBe(true);
  });

  describe('when persisting fails', () => {
    const reason = faker.lorem.sentence();

    beforeEach(() => {
      driver.given.persistFailure(reason).when.rendered();

      return driver.when.mutated(aColumbusState());
    });

    it('should return isError of true when mutated', () => {
      expect(driver.get.result().isError).toBe(true);
    });

    it('should return the failure error when mutated', () => {
      expect(driver.get.result().error?.message).toBe(reason);
    });

    it('should not call window.close when mutated', () => {
      expect(driver.get.closeWindow()).not.toHaveBeenCalled();
    });

    it('should return the failure error from another hook instance when rendered again', () => {
      driver.when.renderedAgain();

      expect(driver.get.otherResult().error?.message).toBe(reason);
    });
  });
});
