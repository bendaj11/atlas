import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { aColumbusState } from '../../types/columbus-state.testkit';
import { OverridesDriver } from './useOverrides.driver';

describe('useOverrides', () => {
  let driver: OverridesDriver;

  beforeEach(() => {
    driver = new OverridesDriver();
  });

  describe('when rendered', () => {
    beforeEach(() => {
      driver.when.rendered();
    });

    it('should return empty message when rendered', () => {
      expect(driver.get.result().message).toBe('');
    });

    it('should call overrideStatusOf with an idle state when rendered', () => {
      expect(driver.get.overrideStatusOf()).toHaveBeenCalledWith({
        isError: false,
        isPending: false,
      });
    });

    it('should call mutateAsync with the next columbusState when an override is toggled', async () => {
      await driver.when.overrideToggled(faker.string.uuid());

      expect(driver.get.mutateAsync()).toHaveBeenCalledWith(
        driver.get.nextColumbusState(),
      );
    });

    it('should call mutateAsync with the next columbusState when an override is saved', async () => {
      await driver.when.overrideSaved({
        productionArtifactVersion: anAppManifest(),
        selectedArtifactVersion: anAppManifest(),
      });

      expect(driver.get.mutateAsync()).toHaveBeenCalledWith(
        driver.get.nextColumbusState(),
      );
    });

    it('should call mutateAsync with the next columbusState when one override is cleared', async () => {
      await driver.when.overrideCleared(faker.string.uuid());

      expect(driver.get.mutateAsync()).toHaveBeenCalledWith(
        driver.get.nextColumbusState(),
      );
    });

    it('should call mutateAsync with the next columbusState when all overrides are cleared', async () => {
      await driver.when.allOverridesCleared();

      expect(driver.get.mutateAsync()).toHaveBeenCalledWith(
        driver.get.nextColumbusState(),
      );
    });

    it('should not call mutateAsync when scope is set', () => {
      driver.when.scopeSet('tab');

      expect(driver.get.mutateAsync()).not.toHaveBeenCalled();
    });
  });

  it('should return the derived overrides presence when rendered', () => {
    driver.given.hasOverrides(true).when.rendered();

    expect(driver.get.result().hasOverrides).toBe(true);
  });

  it('should return the derived status when rendered', () => {
    driver.given.overrideStatus('APPLYING').when.rendered();

    expect(driver.get.result().status).toBe('APPLYING');
  });

  it('should return mutation error message when the mutation has an error', () => {
    const reason = faker.lorem.sentence();
    driver.given.mutationError(new Error(reason)).when.rendered();

    expect(driver.get.result().message).toBe(reason);
  });

  it('should call overrideStatusOf with an error state when the mutation has an error', () => {
    driver.given
      .mutationError(new Error(faker.lorem.sentence()))
      .when.rendered();

    expect(driver.get.overrideStatusOf()).toHaveBeenCalledWith({
      isError: true,
      isPending: false,
    });
  });

  it('should call overrideStatusOf with a pending state when the mutation is pending', () => {
    driver.given.mutationPending(true).when.rendered();

    expect(driver.get.overrideStatusOf()).toHaveBeenCalledWith({
      isError: false,
      isPending: true,
    });
  });

  it('should not call mutateAsync when an override is toggled while the mutation is pending', async () => {
    driver.given.mutationPending(true).when.rendered();

    await driver.when.overrideToggled(faker.string.uuid());

    expect(driver.get.mutateAsync()).not.toHaveBeenCalled();
  });

  it('should not call mutateAsync when an override is toggled with no override to toggle', async () => {
    driver.given.toggleResult(undefined).when.rendered();

    await driver.when.overrideToggled(faker.string.uuid());

    expect(driver.get.mutateAsync()).not.toHaveBeenCalled();
  });

  it('should resolve toggleOverride with undefined when the mutation fails', async () => {
    driver.given.mutationFailure(faker.lorem.sentence()).when.rendered();

    await expect(
      driver.get.result().toggleOverride(faker.string.uuid()),
    ).resolves.toBeUndefined();
  });

  describe('when a columbusState exists', () => {
    const columbusState = aColumbusState({ scope: 'tab' });

    beforeEach(() => {
      driver.given.columbusState(columbusState).when.rendered();
    });

    it('should call hasOverrides with the columbusState when rendered', () => {
      expect(driver.get.hasOverrides()).toHaveBeenCalledWith(columbusState);
    });

    it('should return the columbusState scope when rendered', () => {
      expect(driver.get.result().scope).toBe('tab');
    });

    it('should call toggleArtifactVersionOverride with the columbusState and artifact key when an override is toggled', async () => {
      const artifactKey = faker.string.uuid();

      await driver.when.overrideToggled(artifactKey);

      expect(driver.get.toggleArtifactVersionOverride()).toHaveBeenCalledWith({
        columbusState,
        artifactKey,
      });
    });

    it('should call saveArtifactVersionOverride with the columbusState and selection when an override is saved', async () => {
      const selection = {
        productionArtifactVersion: anAppManifest(),
        selectedArtifactVersion: anAppManifest(),
      };

      await driver.when.overrideSaved(selection);

      expect(driver.get.saveArtifactVersionOverride()).toHaveBeenCalledWith({
        columbusState,
        selection,
      });
    });

    it('should call clearArtifactVersionOverride with the columbusState and artifact key when one override is cleared', async () => {
      const artifactKey = faker.string.uuid();

      await driver.when.overrideCleared(artifactKey);

      expect(driver.get.clearArtifactVersionOverride()).toHaveBeenCalledWith({
        columbusState,
        artifactKey,
      });
    });

    it('should call clearAllArtifactVersionOverrides with the columbusState when all overrides are cleared', async () => {
      await driver.when.allOverridesCleared();

      expect(
        driver.get.clearAllArtifactVersionOverrides(),
      ).toHaveBeenCalledWith(columbusState);
    });

    it('should store the scoped columbusState when scope is set', () => {
      driver.when.scopeSet('all');

      expect(driver.get.storedColumbusStateUpdate(columbusState)).toBe(
        driver.get.nextColumbusState(),
      );
    });
  });

  describe('when columbusState is missing', () => {
    beforeEach(() => {
      driver.given.columbusState(undefined).when.rendered();
    });

    it('should return scope of all when rendered', () => {
      expect(driver.get.result().scope).toBe('all');
    });

    it('should not call mutateAsync when an override is toggled', async () => {
      await driver.when.overrideToggled(faker.string.uuid());

      expect(driver.get.mutateAsync()).not.toHaveBeenCalled();
    });

    it('should keep the columbusState missing when scope is set', () => {
      driver.when.scopeSet('tab');

      expect(driver.get.storedColumbusStateUpdate(undefined)).toBeUndefined();
    });
  });
});
