import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { SCOPES } from '../../types/columbus-state';
import { aColumbusState } from '../../testkit/columbus-state.testkit';
import { OverridesDriver } from './useOverrides.driver';

describe('useOverrides', () => {
  let driver: OverridesDriver;

  beforeEach(() => {
    driver = new OverridesDriver();
  });

  it('should return the columbusState scope when rendered', () => {
    const columbusState = aColumbusState();

    driver.given.columbusState(columbusState).when.rendered();

    expect(driver.get.result().scope).toBe(columbusState.scope);
  });

  it('should return hasOverrides of true when an enabled override exists', () => {
    const columbusState = aColumbusState({
      enabledArtifactVersionOverrides: new Map([
        [faker.string.uuid(), anAppManifest()],
      ]),
    });

    driver.given.columbusState(columbusState).when.rendered();

    expect(driver.get.result().hasOverrides).toBe(true);
  });

  it('should return hasOverrides of true when a disabled override exists', () => {
    const columbusState = aColumbusState({
      disabledArtifactVersionOverrides: new Map([
        [faker.string.uuid(), anAppManifest()],
      ]),
    });

    driver.given.columbusState(columbusState).when.rendered();

    expect(driver.get.result().hasOverrides).toBe(true);
  });

  it('should return hasOverrides of false when no override exists', () => {
    const columbusState = aColumbusState({
      enabledArtifactVersionOverrides: new Map(),
      disabledArtifactVersionOverrides: new Map(),
    });

    driver.given.columbusState(columbusState).when.rendered();

    expect(driver.get.result().hasOverrides).toBe(false);
  });

  it('should return status of APPLYING when the mutation is pending', () => {
    driver.given.mutationPending(true).when.rendered();

    expect(driver.get.result().status).toBe('APPLYING');
  });

  it('should return an empty message when the mutation has no error', () => {
    driver.given.mutationError(null).when.rendered();

    expect(driver.get.result().message).toBe('');
  });

  it('should return the mutation error message when the mutation has an error', () => {
    const error = new Error(faker.lorem.sentence());

    driver.given.mutationError(error).when.rendered();

    expect(driver.get.result().message).toBe(error.message);
  });

  it('should return status of APPLYING when the mutation has an error and is pending', () => {
    driver.given
      .mutationError(new Error(faker.lorem.sentence()))
      .given.mutationPending(true)
      .when.rendered();

    expect(driver.get.result().status).toBe('APPLYING');
  });

  it('should return status of ERROR when the mutation has an error and is not pending', () => {
    driver.given
      .mutationError(new Error(faker.lorem.sentence()))
      .given.mutationPending(false)
      .when.rendered();

    expect(driver.get.result().status).toBe('ERROR');
  });

  it('should return status of IDLE when the mutation has no error and is not pending', () => {
    driver.given
      .mutationError(null)
      .given.mutationPending(false)
      .when.rendered();

    expect(driver.get.result().status).toBe('IDLE');
  });

  it('should not call mutateAsync when scope is set', () => {
    driver.when.rendered();

    driver.when.scopeSet(faker.helpers.arrayElement(SCOPES));

    expect(driver.get.mutateAsync()).not.toHaveBeenCalled();
  });

  it('should call setColumbusState with an update to the new scope when scope is set', () => {
    const columbusState = aColumbusState();
    const scope = faker.helpers.arrayElement(SCOPES);

    driver.given.columbusState(columbusState).when.rendered();

    driver.when.scopeSet(scope);

    expect(driver.get.storedColumbusStateUpdate(columbusState)).toEqual({
      ...columbusState,
      scope,
    });
  });

  it('should not call mutateAsync when an override is toggled while the mutation is pending', async () => {
    const artifactKey = faker.string.uuid();
    const columbusState = aColumbusState({
      enabledArtifactVersionOverrides: new Map([
        [artifactKey, anAppManifest()],
      ]),
    });

    driver.given
      .columbusState(columbusState)
      .given.mutationPending(true)
      .when.rendered();

    await driver.when.overrideToggled(artifactKey);

    expect(driver.get.mutateAsync()).not.toHaveBeenCalled();
  });

  it('should not call mutateAsync when an override is toggled with no override under that key', async () => {
    driver.given
      .columbusState(
        aColumbusState({
          enabledArtifactVersionOverrides: new Map(),
          disabledArtifactVersionOverrides: new Map(),
        }),
      )
      .given.mutationPending(false)
      .when.rendered();

    await driver.when.overrideToggled(faker.string.uuid());

    expect(driver.get.mutateAsync()).not.toHaveBeenCalled();
  });

  it('should resolve toggleOverride with undefined when the mutation rejects', async () => {
    const artifactKey = faker.string.uuid();
    const columbusState = aColumbusState({
      enabledArtifactVersionOverrides: new Map([
        [artifactKey, anAppManifest()],
      ]),
    });

    driver.given
      .columbusState(columbusState)
      .given.mutationPending(false)
      .given.mutation(Promise.reject(new Error(faker.lorem.sentence())))
      .when.rendered();

    await expect(
      driver.get.result().toggleOverride(artifactKey),
    ).resolves.toBeUndefined();
  });

  describe('when the mutation is not pending and resolves', () => {
    beforeEach(() => {
      driver.given.mutationPending(false).given.mutation(Promise.resolve());
    });

    it('should call mutateAsync with the override moved to disabled when an enabled override is toggled', async () => {
      const artifactKey = faker.string.uuid();
      const artifactVersion = anAppManifest();

      driver.given
        .columbusState(
          aColumbusState({
            enabledArtifactVersionOverrides: new Map([
              [artifactKey, artifactVersion],
            ]),
            disabledArtifactVersionOverrides: new Map(),
          }),
        )
        .when.rendered();

      await driver.when.overrideToggled(artifactKey);

      expect(driver.get.mutateAsync()).toHaveBeenCalledWith(
        expect.objectContaining({
          enabledArtifactVersionOverrides: new Map(),
          disabledArtifactVersionOverrides: new Map([
            [artifactKey, artifactVersion],
          ]),
        }),
      );
    });

    it('should call mutateAsync with the override moved to enabled when a disabled override is toggled', async () => {
      const artifactKey = faker.string.uuid();
      const artifactVersion = anAppManifest();

      driver.given
        .columbusState(
          aColumbusState({
            enabledArtifactVersionOverrides: new Map(),
            disabledArtifactVersionOverrides: new Map([
              [artifactKey, artifactVersion],
            ]),
          }),
        )
        .when.rendered();

      await driver.when.overrideToggled(artifactKey);

      expect(driver.get.mutateAsync()).toHaveBeenCalledWith(
        expect.objectContaining({
          enabledArtifactVersionOverrides: new Map([
            [artifactKey, artifactVersion],
          ]),
          disabledArtifactVersionOverrides: new Map(),
        }),
      );
    });

    it('should call mutateAsync with the selected version enabled under the deployed id when an override is saved', async () => {
      const selection = {
        deployedArtifactVersion: anAppManifest(),
        selectedOverrideArtifactVersion: anAppManifest(),
      };

      driver.given.columbusState(aColumbusState()).when.rendered();

      await driver.when.overrideSaved(selection);

      expect(driver.get.mutateAsync()).toHaveBeenCalledWith(
        expect.objectContaining({
          enabledArtifactVersionOverrides: new Map([
            [
              selection.deployedArtifactVersion.id,
              selection.selectedOverrideArtifactVersion,
            ],
          ]),
        }),
      );
    });

    it('should call mutateAsync with the override removed when one override is cleared', async () => {
      const artifactKey = faker.string.uuid();

      driver.given
        .columbusState(
          aColumbusState({
            enabledArtifactVersionOverrides: new Map([
              [artifactKey, anAppManifest()],
            ]),
            disabledArtifactVersionOverrides: new Map(),
          }),
        )
        .when.rendered();

      await driver.when.overrideCleared(artifactKey);

      expect(driver.get.mutateAsync()).toHaveBeenCalledWith(
        expect.objectContaining({
          enabledArtifactVersionOverrides: new Map(),
          disabledArtifactVersionOverrides: new Map(),
        }),
      );
    });

    it('should call mutateAsync with no overrides when all overrides are cleared', async () => {
      driver.given
        .columbusState(
          aColumbusState({
            enabledArtifactVersionOverrides: new Map([
              [faker.string.uuid(), anAppManifest()],
            ]),
            disabledArtifactVersionOverrides: new Map([
              [faker.string.uuid(), anAppManifest()],
            ]),
          }),
        )
        .when.rendered();

      await driver.when.allOverridesCleared();

      expect(driver.get.mutateAsync()).toHaveBeenCalledWith(
        expect.objectContaining({
          enabledArtifactVersionOverrides: new Map(),
          disabledArtifactVersionOverrides: new Map(),
        }),
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

    it('should return hasOverrides of false when rendered', () => {
      expect(driver.get.result().hasOverrides).toBe(false);
    });

    it('should not call mutateAsync when an override is toggled', async () => {
      await driver.when.overrideToggled(faker.string.uuid());

      expect(driver.get.mutateAsync()).not.toHaveBeenCalled();
    });

    it('should call setColumbusState with an update keeping the columbusState missing when scope is set', () => {
      driver.when.scopeSet(faker.helpers.arrayElement(SCOPES));

      expect(driver.get.storedColumbusStateUpdate(undefined)).toBeUndefined();
    });
  });
});
