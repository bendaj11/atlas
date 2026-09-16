import { faker } from '@faker-js/faker';
import { anArtifactConfiguration } from '../../../../types/artifact.testkit';
import { UseSaveArtifactOverrideDriver } from './useSaveArtifactOverride.driver';

describe('useSaveArtifactOverride', () => {
  let driver: UseSaveArtifactOverrideDriver;

  beforeEach(() => {
    driver = new UseSaveArtifactOverrideDriver();
  });

  describe('when rendered', () => {
    beforeEach(() => {
      driver.when.rendered();
    });

    it('should return undefined error message when rendered', () => {
      expect(driver.get.result().errorMessage).toBeUndefined();
    });

    it('should call mutateAsync once when saved', async () => {
      await driver.when.saved();

      expect(driver.get.mutateAsync()).toHaveBeenCalledTimes(1);
    });
  });

  it('should not call saveOverride when the override is cleared without a configuration', async () => {
    driver.given.configuration(undefined).when.rendered();

    await driver.when.overrideCleared();

    expect(driver.get.saveOverride()).not.toHaveBeenCalled();
  });

  it('should call saveOverride with an empty selection when the override is cleared', async () => {
    const configuration = anArtifactConfiguration();
    driver.given.configuration(configuration).when.rendered();

    await driver.when.overrideCleared();

    expect(driver.get.saveOverride()).toHaveBeenCalledWith({
      productionArtifactVersion: configuration.productionArtifactVersion,
      selectedArtifactVersion: undefined,
    });
  });

  it('should resolve save with undefined when the mutation fails', async () => {
    driver.given.mutationFailure(faker.lorem.sentence()).when.rendered();

    await expect(driver.get.result().save()).resolves.toBeUndefined();
  });

  it.each([true, false])(
    'should return loading of %s when the mutation pending state is %s',
    (pending) => {
      driver.given.mutationPending(pending).when.rendered();

      expect(driver.get.result().loading).toBe(pending);
    },
  );

  describe('when the mutation has an error', () => {
    const reason = faker.lorem.sentence();

    beforeEach(() => {
      driver.given.mutationError(new Error(reason));
    });

    it('should return a failure message of the error when rendered', () => {
      driver.when.rendered();

      expect(driver.get.result().errorMessage).toContain(reason);
    });

    it('should return the failure message instead of the override message when override status is ERROR', () => {
      driver.given
        .overrideStatus('ERROR')
        .given.overrideMessage(faker.lorem.sentence())
        .when.rendered();

      expect(driver.get.result().errorMessage).toContain(reason);
    });
  });

  describe('when the override has a message', () => {
    const message = faker.lorem.sentence();

    beforeEach(() => {
      driver.given.overrideMessage(message);
    });

    it('should return the override message when override status is ERROR', () => {
      driver.given.overrideStatus('ERROR').when.rendered();

      expect(driver.get.result().errorMessage).toBe(message);
    });

    it.each(['IDLE', 'APPLYING'] as const)(
      'should return undefined error message when override status is %s',
      (status) => {
        driver.given.overrideStatus(status).when.rendered();

        expect(driver.get.result().errorMessage).toBeUndefined();
      },
    );
  });
});
