import { faker } from '@faker-js/faker';
import { aColumbusState } from '../../testkit/columbus-state.testkit';
import { UsePersistOverridesMutationDriver } from './usePersistOverridesMutation.driver';

describe('usePersistOverridesMutation', () => {
  let driver: UsePersistOverridesMutationDriver;

  beforeEach(() => {
    driver = new UsePersistOverridesMutationDriver();
  });

  it('should return isPending of false when rendered', () => {
    driver.when.rendered();

    expect(driver.get.result().isPending).toBe(false);
  });

  describe('when persisting succeeds', () => {
    beforeEach(() => {
      driver.given.persist(Promise.resolve()).when.rendered();
    });

    it('should call setColumbusState with the columbusState when mutated', async () => {
      const columbusState = aColumbusState();

      await driver.when.mutated(columbusState);

      expect(driver.get.setColumbusState()).toHaveBeenCalledWith(columbusState);
    });

    it('should call persistColumbusState with the columbusState when mutated', async () => {
      const columbusState = aColumbusState();

      await driver.when.mutated(columbusState);

      expect(driver.get.persistColumbusState()).toHaveBeenCalledWith(
        columbusState,
      );
    });

    it('should call window.close once when mutated', async () => {
      await driver.when.mutated(aColumbusState());

      expect(driver.get.closeWindow()).toHaveBeenCalledTimes(1);
    });
  });

  describe('when persisting is pending', () => {
    beforeEach(() => {
      driver.given.persist(new Promise(() => {})).when.rendered();
    });

    it('should return isPending of true when mutation is started', async () => {
      await driver.when.mutationStarted(aColumbusState());

      expect(driver.get.result().isPending).toBe(true);
    });

    it('should return isPending of true from another hook instance when mutation is started', async () => {
      driver.when.renderedAgain();
      await driver.when.mutationStarted(aColumbusState());

      expect(driver.get.otherResult().isPending).toBe(true);
    });
  });

  describe('when persisting fails', () => {
    const reason = faker.lorem.sentence();

    beforeEach(async () => {
      driver.given.persist(Promise.reject(new Error(reason))).when.rendered();

      await driver.when.mutated(aColumbusState());
    });

    it('should return isError of true when mutated', () => {
      expect(driver.get.result().isError).toBe(true);
    });

    it('should return an error with the failure reason when mutated', () => {
      expect(driver.get.result().error?.message).toContain(reason);
    });

    it('should return an error with a retry hint when mutated', () => {
      expect(driver.get.result().error?.message).toContain('and retry.');
    });

    it('should not call window.close when mutated', () => {
      expect(driver.get.closeWindow()).not.toHaveBeenCalled();
    });

    it('should return the failure error from another hook instance when rendered again', () => {
      driver.when.renderedAgain();

      expect(driver.get.otherResult().error?.message).toContain(reason);
    });
  });
});
