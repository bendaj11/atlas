import { aManifest, aSession } from '../../types/app.testkit';
import { PersistOverridesDriver } from './persist-overrides.driver';

describe('persistOverrideSession', () => {
  let driver: PersistOverridesDriver;

  beforeEach(() => {
    driver = new PersistOverridesDriver();
  });

  it('should validate every active override when persisting', async () => {
    const local = aManifest({ channel: 'local' });
    const preview = aManifest({ channel: 'pr' });

    await driver.given
      .session(
        aSession({
          activeOverrides: new Map([
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
      .session(aSession({ activeOverrides: new Map([['app:a', aManifest()]]) }))
      .given.validationFailure('Dev server down.')
      .when.persisted();

    expect(driver.get.callOrder()).toEqual([]);
  });

  it('should surface the validation error when validation fails', async () => {
    await driver.given
      .session(aSession({ activeOverrides: new Map([['app:a', aManifest()]]) }))
      .given.validationFailure('Dev server down.')
      .when.persisted();

    expect(driver.get.error()).toEqual(new Error('Dev server down.'));
  });

  it('should write document, disabled, suppressed, then reload when persisting', async () => {
    await driver.when.persisted();

    expect(driver.get.callOrder()).toEqual([
      'writeOverrideDocument',
      'writeDisabledOverrides',
      'writeSuppressedArtifactIds',
      'reload',
    ]);
  });

  it('should build the override document from the active overrides when persisting', async () => {
    const override = aManifest({ id: 'orders' });

    await driver.given
      .session(
        aSession({ activeOverrides: new Map([['app:orders', override]]) }),
      )
      .when.persisted();

    expect(driver.get.overridesWrite()?.documentValue.overrides).toEqual([
      { appId: 'orders', manifest: override, reason: 'historical' },
    ]);
  });

  it('should pass the session scope and tab when writing the override document', async () => {
    await driver.given
      .session(aSession({ tabId: 7, scope: 'tab' }))
      .when.persisted();

    expect(driver.get.overridesWrite()).toMatchObject({
      tabId: 7,
      scope: 'tab',
    });
  });

  it('should list raw app ids when disabled and suppressed overrides exist', async () => {
    await driver.given
      .session(
        aSession({
          disabledOverrides: new Map([
            ['app:orders', aManifest({ id: 'orders' })],
          ]),
          suppressedArtifactIds: new Set(['cart', 'orders']),
        }),
      )
      .when.persisted();

    expect(driver.get.overridesWrite()?.disabledAppIds).toEqual([
      'orders',
      'cart',
    ]);
  });

  it('should write disabled overrides when the session has a host, tab, and scope', async () => {
    const session = aSession({ tabId: 7, scope: 'tab' });

    await driver.given.session(session).when.persisted();

    expect(driver.get.disabledOverridesWrite()).toEqual([
      { hostId: session.hostData.config.hostId, tabId: 7, scope: 'tab' },
      session.disabledOverrides,
    ]);
  });

  it('should write suppressed artifact ids when the session has a host, tab, and scope', async () => {
    const session = aSession({
      tabId: 7,
      suppressedArtifactIds: new Set(['cart']),
    });

    await driver.given.session(session).when.persisted();

    expect(driver.get.suppressedArtifactIdsWrite()).toEqual([
      { hostId: session.hostData.config.hostId, tabId: 7, scope: 'all' },
      session.suppressedArtifactIds,
    ]);
  });

  it('should reload the session tab when everything is written', async () => {
    await driver.given.session(aSession({ tabId: 7 })).when.persisted();

    expect(driver.get.reloadedTabId()).toBe(7);
  });
});
