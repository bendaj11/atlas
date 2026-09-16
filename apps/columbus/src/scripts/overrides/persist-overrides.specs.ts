import { anAppManifest } from '@atlas/testkit';
import { aColumbusState } from '../../types/columbus-state.testkit';
import { PersistOverridesDriver } from './persist-overrides.driver';

describe('persistColumbusState', () => {
  let driver: PersistOverridesDriver;

  beforeEach(() => {
    driver = new PersistOverridesDriver();
  });

  it('should validate every active override when persisting', async () => {
    const local = anAppManifest({ channel: 'local' });
    const preview = anAppManifest({ channel: 'pr' });

    await driver.given
      .columbusState(
        aColumbusState({
          enabledArtifactVersionOverrides: new Map([
            ['app:a', local],
            ['app:b', preview],
          ]),
        }),
      )
      .when.persisted();

    expect(driver.get.validatedManifests()).toEqual([local, preview]);
  });

  it('should write nothing when validation fails', async () => {
    await driver.given
      .columbusState(
        aColumbusState({
          enabledArtifactVersionOverrides: new Map([
            ['app:a', anAppManifest()],
          ]),
        }),
      )
      .given.validationFailure('Dev server down.')
      .when.persisted();

    expect(driver.get.callOrder()).toEqual([]);
  });

  it('should surface the validation error when validation fails', async () => {
    await driver.given
      .columbusState(
        aColumbusState({
          enabledArtifactVersionOverrides: new Map([
            ['app:a', anAppManifest()],
          ]),
        }),
      )
      .given.validationFailure('Dev server down.')
      .when.persisted();

    expect(driver.get.error()).toEqual(new Error('Dev server down.'));
  });

  it('should write document, disabled, suppressed, then reload when persisting', async () => {
    await driver.when.persisted();

    expect(driver.get.callOrder()).toEqual([
      'writeOverrideDocument',
      'writeDisabledArtifactVersionOverrides',
      'writeClearedLocalArtifactIds',
      'reload',
    ]);
  });

  it('should build the override document from the active overrides when persisting', async () => {
    const override = anAppManifest({
      id: 'orders',
      channel: 'production',
    });

    await driver.given
      .columbusState(
        aColumbusState({
          enabledArtifactVersionOverrides: new Map([['app:orders', override]]),
        }),
      )
      .when.persisted();

    expect(driver.get.overridesWrite()?.documentValue.overrides).toEqual([
      { appId: 'orders', manifest: override, reason: 'historical' },
    ]);
  });

  it('should pass the columbusState scope and tab when writing the override document', async () => {
    await driver.given
      .columbusState(aColumbusState({ tabId: 7, scope: 'tab' }))
      .when.persisted();

    expect(driver.get.overridesWrite()).toMatchObject({
      tabId: 7,
      scope: 'tab',
    });
  });

  it('should list raw app ids when disabled and suppressed overrides exist', async () => {
    await driver.given
      .columbusState(
        aColumbusState({
          disabledArtifactVersionOverrides: new Map([
            ['app:orders', anAppManifest({ id: 'orders' })],
          ]),
          clearedLocalArtifactIds: new Set(['cart', 'orders']),
        }),
      )
      .when.persisted();

    expect(driver.get.overridesWrite()?.disabledAppIds).toEqual([
      'orders',
      'cart',
    ]);
  });

  it('should write disabled overrides when the columbusState has a host, tab, and scope', async () => {
    const columbusState = aColumbusState({ tabId: 7, scope: 'tab' });

    await driver.given.columbusState(columbusState).when.persisted();

    expect(driver.get.disabledOverridesWrite()).toEqual([
      { hostId: columbusState.hostData.config.hostId, tabId: 7, scope: 'tab' },
      columbusState.disabledArtifactVersionOverrides,
    ]);
  });

  it('should write suppressed artifact ids when the columbusState has a host, tab, and scope', async () => {
    const columbusState = aColumbusState({
      tabId: 7,
      clearedLocalArtifactIds: new Set(['cart']),
    });

    await driver.given.columbusState(columbusState).when.persisted();

    expect(driver.get.suppressedArtifactIdsWrite()).toEqual([
      { hostId: columbusState.hostData.config.hostId, tabId: 7, scope: 'all' },
      columbusState.clearedLocalArtifactIds,
    ]);
  });

  it('should reload the columbusState tab when everything is written', async () => {
    await driver.given
      .columbusState(aColumbusState({ tabId: 7 }))
      .when.persisted();

    expect(driver.get.reloadedTabId()).toBe(7);
  });
});
