import {
  aHostData,
  aManifest,
  aSession,
  anAppManifest,
} from '../../../types/app.testkit';
import { HostContextDriver } from './HostContext.driver';

describe('HostProvider', () => {
  let driver: HostContextDriver;

  beforeEach(() => {
    driver = new HostContextDriver();
  });

  it('should start restoring when rendered', () => {
    driver.when.rendered();

    expect(driver.get.status()).toBe('RESTORING');
  });

  describe('when a cached host exists and no session is loaded', () => {
    beforeEach(() => {
      driver.given.cachedHost(aHostData(), 7);
    });

    it('should store the cached session when host is loaded', async () => {
      await driver.when.rendered().when.hostLoaded();

      expect(driver.get.storedSession()?.tabId).toBe(7);
    });

    it('should report loaded when cached host is used', async () => {
      await driver.when.rendered().when.hostLoaded();

      expect(driver.get.status()).toBe('LOADED');
    });

    it('should not read the active tab when cached host is used', async () => {
      await driver.when.rendered().when.hostLoaded();

      expect(driver.get.activeHostReadCount()).toBe(0);
    });

    it('should skip the cache when a session already exists', async () => {
      await driver.given
        .session(aSession())
        .given.activeHost(aHostData(), 3)
        .when.rendered()
        .when.hostLoaded();

      expect(driver.get.cacheReadCount()).toBe(0);
    });
  });

  describe('when the active tab is read', () => {
    it('should report loading when the active read is pending', async () => {
      await driver.given
        .activeHostReadPending()
        .when.rendered()
        .when.hostLoadStarted();

      expect(driver.get.status()).toBe('LOADING');
    });

    it('should fall back to the active tab when the cache read fails', async () => {
      await driver.given
        .cacheReadFailure()
        .given.activeHost(aHostData(), 3)
        .when.rendered()
        .when.hostLoaded();

      expect(driver.get.status()).toBe('LOADED');
    });

    it('should store the tab id when host is loaded', async () => {
      await driver.given
        .activeHost(aHostData(), 3)
        .when.rendered()
        .when.hostLoaded();

      expect(driver.get.storedSession()?.tabId).toBe(3);
    });

    it('should clear the message when host is loaded', async () => {
      await driver.given
        .activeHost(aHostData(), 3)
        .when.rendered()
        .when.hostLoaded();

      expect(driver.get.message()).toBe('');
    });

    it.each([
      ['tab', 'tab'],
      ['all', 'all'],
      [undefined, 'all'],
    ] as const)(
      'should use scope %s when host override scope is %s',
      async (overrideScope, scope) => {
        await driver.given
          .activeHost(aHostData({ overrideScope }), 3)
          .when.rendered()
          .when.hostLoaded();

        expect(driver.get.storedSession()?.scope).toBe(scope);
      },
    );

    it('should read disabled overrides for the host tab and scope when host is loaded', async () => {
      const hostData = aHostData({ overrideScope: 'tab' });

      await driver.given
        .activeHost(hostData, 3)
        .when.rendered()
        .when.hostLoaded();

      expect(driver.get.disabledOverridesRequest()).toEqual({
        hostId: hostData.config.hostId,
        tabId: 3,
        scope: 'tab',
      });
    });

    it('should store active overrides from the override document when host is loaded', async () => {
      const override = anAppManifest({ id: 'orders' });
      const hostData = aHostData({
        overrides: {
          schemaVersion: '1',
          hostId: 'host',
          overrides: [{ appId: 'orders', manifest: override, reason: 'local' }],
          generatedAt: '2026-01-01T00:00:00.000Z',
        },
      });

      await driver.given
        .activeHost(hostData, 3)
        .when.rendered()
        .when.hostLoaded();

      expect(
        driver.get.storedSession()?.activeOverrides.get('app:orders')?.id,
      ).toBe('orders');
    });

    it('should store disabled overrides when host is loaded', async () => {
      const disabled = new Map([['app:orders', aManifest()]]);

      await driver.given
        .activeHost(aHostData(), 3)
        .given.disabledOverrides(disabled)
        .when.rendered()
        .when.hostLoaded();

      expect(driver.get.storedSession()?.disabledOverrides).toBe(disabled);
    });

    it('should store suppressed artifact ids when host is loaded', async () => {
      const suppressed = new Set(['orders']);

      await driver.given
        .activeHost(aHostData(), 3)
        .given.suppressedArtifactIds(suppressed)
        .when.rendered()
        .when.hostLoaded();

      expect(driver.get.storedSession()?.suppressedArtifactIds).toBe(
        suppressed,
      );
    });

    it('should add override apps to the catalog when they are not deployed', async () => {
      const overrideApp = anAppManifest({ id: 'preview' });

      await driver.given
        .activeHost(aHostData(), 3)
        .given.disabledOverrides(new Map([['app:preview', overrideApp]]))
        .when.rendered()
        .when.hostLoaded();

      expect(driver.get.storedSession()?.hostData.catalog.apps).toEqual([
        overrideApp,
      ]);
    });
  });

  describe('when the active tab read fails', () => {
    beforeEach(() => {
      driver.given.activeHostReadFailure('No Atlas tab.');
    });

    it('should report error when host cannot be read', async () => {
      await driver.when.rendered().when.hostLoaded();

      expect(driver.get.status()).toBe('ERROR');
    });

    it('should explain the failure when host cannot be read', async () => {
      await driver.when.rendered().when.hostLoaded();

      expect(driver.get.message()).toContain('No Atlas tab.');
    });

    it('should clear the session when host cannot be read', async () => {
      await driver.when.rendered().when.hostLoaded();

      expect(driver.get.storedSession()).toBeUndefined();
    });
  });
});
