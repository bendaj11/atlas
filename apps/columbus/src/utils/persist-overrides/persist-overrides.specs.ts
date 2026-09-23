import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { aColumbusState } from '../../testkit/columbus-state.testkit';
import { PersistOverridesDriver } from './persist-overrides.driver';

const { persistColumbusState } = await import('./persist-overrides');

describe('persistColumbusState', () => {
  let driver: PersistOverridesDriver;

  beforeEach(() => {
    driver = new PersistOverridesDriver();
  });

  it('should validate every enabled override when persisting', async () => {
    const local = anAppManifest({ channel: 'local' });
    const preview = anAppManifest({ channel: 'pr' });

    await persistColumbusState(
      aColumbusState({
        enabledArtifactVersionOverrides: new Map([
          [local.id, local],
          [preview.id, preview],
        ]),
      }),
    );

    expect(
      driver.get
        .validateLocalOverride()
        .mock.calls.map(([manifest]) => manifest),
    ).toStrictEqual([local, preview]);
  });

  describe('when validation fails', () => {
    const reason = faker.lorem.sentence();
    const columbusState = aColumbusState({
      enabledArtifactVersionOverrides: new Map([
        [faker.string.uuid(), anAppManifest()],
      ]),
    });

    beforeEach(() => {
      driver.given.validationFailure(new Error(reason));
    });

    it('should reject with the validation error when persisting', async () => {
      await expect(persistColumbusState(columbusState)).rejects.toThrow(reason);
    });

    it('should not write the override document when persisting', async () => {
      await persistColumbusState(columbusState).catch(() => undefined);

      expect(driver.get.writeOverrideDocument()).not.toHaveBeenCalled();
    });
  });

  it('should write document, disabled overrides, cleared ids, then reload when persisting', async () => {
    await persistColumbusState(aColumbusState());

    const order = [
      driver.get.writeOverrideDocument(),
      driver.get.writeDisabledArtifactVersionOverrides(),
      driver.get.writeClearedLocalArtifactIds(),
      driver.get.reloadHostTab(),
    ].map((mock) => mock.mock.invocationCallOrder[0]);

    expect(order).toStrictEqual([...order].sort((left, right) => left - right));
  });

  it('should write the override document built from the enabled overrides when persisting', async () => {
    const override = anAppManifest({ channel: 'production' });
    const columbusState = aColumbusState({
      enabledArtifactVersionOverrides: new Map([[override.id, override]]),
    });

    await persistColumbusState(columbusState);

    expect(driver.get.writeOverrideDocument()).toHaveBeenCalledWith({
      tabId: columbusState.tabId,
      hostData: columbusState.hostData,
      documentValue: {
        schemaVersion: '1',
        hostId: columbusState.hostData.config.hostId,
        generatedAt: expect.any(String),
        overrides: [
          { appId: override.id, manifest: override, reason: 'historical' },
        ],
      },
      scope: columbusState.scope,
      disabledAppIds: [],
    });
  });

  it('should list the disabled and cleared app ids once each when both exist', async () => {
    const disabled = anAppManifest();
    const cleared = faker.string.uuid();
    const columbusState = aColumbusState({
      disabledArtifactVersionOverrides: new Map([[disabled.id, disabled]]),
      clearedLocalArtifactIds: new Set([cleared, disabled.id]),
    });

    await persistColumbusState(columbusState);

    expect(driver.get.writeOverrideDocument()).toHaveBeenCalledWith(
      expect.objectContaining({ disabledAppIds: [disabled.id, cleared] }),
    );
  });

  it('should write the disabled overrides under the state location when persisting', async () => {
    const columbusState = aColumbusState({
      disabledArtifactVersionOverrides: new Map([
        [faker.string.uuid(), anAppManifest()],
      ]),
    });

    await persistColumbusState(columbusState);

    expect(
      driver.get.writeDisabledArtifactVersionOverrides(),
    ).toHaveBeenCalledWith(
      {
        hostId: columbusState.hostData.config.hostId,
        tabId: columbusState.tabId,
        scope: columbusState.scope,
      },
      columbusState.disabledArtifactVersionOverrides,
    );
  });

  it('should write the cleared local artifact ids under the state location when persisting', async () => {
    const columbusState = aColumbusState({
      clearedLocalArtifactIds: new Set([faker.string.uuid()]),
    });

    await persistColumbusState(columbusState);

    expect(driver.get.writeClearedLocalArtifactIds()).toHaveBeenCalledWith(
      {
        hostId: columbusState.hostData.config.hostId,
        tabId: columbusState.tabId,
        scope: columbusState.scope,
      },
      columbusState.clearedLocalArtifactIds,
    );
  });

  it('should reload the state tab when everything is written', async () => {
    const columbusState = aColumbusState();

    await persistColumbusState(columbusState);

    expect(driver.get.reloadHostTab()).toHaveBeenCalledWith(
      columbusState.tabId,
    );
  });
});
