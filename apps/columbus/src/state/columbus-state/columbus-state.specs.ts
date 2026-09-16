import { aHostData } from '../../types/host-data.testkit';
import { anAppArtifactVersion } from '../../types/artifact-version.testkit';
import { ColumbusStateDriver } from './columbus-state.driver';

const HOST_STATUSES = [
  ['LOADING', { isError: false, isFetching: true }],
  ['LOADING', { isError: true, isFetching: true }],
  ['ERROR', { isError: true, isFetching: false }],
  ['LOADED', { isError: false, isFetching: false }],
] as const;

describe('loadColumbusState', () => {
  let driver: ColumbusStateDriver;

  beforeEach(() => {
    driver = new ColumbusStateDriver();
  });

  describe('when a cached host exists', () => {
    beforeEach(() => {
      driver.given.cachedHost(aHostData(), 7);
    });

    it('should use the cached tab when no columbusState exists', async () => {
      await driver.when.columbusStateLoaded();

      expect(driver.get.columbusState()?.tabId).toBe(7);
    });

    it('should not read the active tab when no columbusState exists', async () => {
      await driver.when.columbusStateLoaded();

      expect(driver.get.activeHostReadCount()).toBe(0);
    });

    it('should skip the cache when a columbusState already exists', async () => {
      await driver.given
        .hasColumbusState(true)
        .given.activeHost(aHostData(), 3)
        .when.columbusStateLoaded();

      expect(driver.get.cacheReadCount()).toBe(0);
    });
  });

  describe('when the active tab is read', () => {
    it('should fall back to the active tab when the cache read fails', async () => {
      await driver.given
        .cacheReadFailure()
        .given.activeHost(aHostData(), 3)
        .when.columbusStateLoaded();

      expect(driver.get.columbusState()?.tabId).toBe(3);
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
          .when.columbusStateLoaded();

        expect(driver.get.columbusState()?.scope).toBe(scope);
      },
    );

    it('should read disabled overrides for the host tab and scope when loaded', async () => {
      const hostData = aHostData({ overrideScope: 'tab' });

      await driver.given.activeHost(hostData, 3).when.columbusStateLoaded();

      expect(driver.get.disabledOverridesRequest()).toEqual({
        hostId: hostData.config.hostId,
        tabId: 3,
        scope: 'tab',
      });
    });

    it('should expose active overrides from the override document when loaded', async () => {
      const override = anAppArtifactVersion({ id: 'orders' });
      const hostData = aHostData({
        overrides: {
          schemaVersion: '1',
          hostId: 'host',
          overrides: [{ appId: 'orders', manifest: override, reason: 'local' }],
          generatedAt: '2026-01-01T00:00:00.000Z',
        },
      });

      await driver.given.activeHost(hostData, 3).when.columbusStateLoaded();

      expect(
        driver.get
          .columbusState()
          ?.enabledArtifactVersionOverrides.get('app:orders')?.id,
      ).toBe('orders');
    });

    it('should expose disabled overrides when loaded', async () => {
      const disabled = new Map([['app:orders', anAppArtifactVersion()]]);

      await driver.given
        .activeHost(aHostData(), 3)
        .given.disabledArtifactVersionOverrides(disabled)
        .when.columbusStateLoaded();

      expect(driver.get.columbusState()?.disabledArtifactVersionOverrides).toBe(
        disabled,
      );
    });

    it('should expose suppressed artifact ids when loaded', async () => {
      const suppressed = new Set(['orders']);

      await driver.given
        .activeHost(aHostData(), 3)
        .given.clearedLocalArtifactIds(suppressed)
        .when.columbusStateLoaded();

      expect(driver.get.columbusState()?.clearedLocalArtifactIds).toBe(
        suppressed,
      );
    });

    it('should add override apps to the catalog when they are not deployed', async () => {
      const overrideApp = anAppArtifactVersion({ id: 'preview' });

      await driver.given
        .activeHost(aHostData(), 3)
        .given.disabledArtifactVersionOverrides(
          new Map([['app:preview', overrideApp]]),
        )
        .when.columbusStateLoaded();

      expect(driver.get.columbusState()?.hostData.catalog.apps).toEqual([
        overrideApp,
      ]);
    });
  });

  describe('when the active tab read fails', () => {
    beforeEach(() => {
      driver.given.activeHostReadFailure('No Atlas tab.');
    });

    it('should reject with the failure reason when host cannot be read', async () => {
      await driver.when.columbusStateLoaded();

      expect(driver.get.failureMessage()).toContain('No Atlas tab.');
    });

    it('should reject with a retry hint when host cannot be read', async () => {
      await driver.when.columbusStateLoaded();

      expect(driver.get.failureMessage()).toContain('then retry.');
    });
  });
});

describe('hostStatusOf', () => {
  let driver: ColumbusStateDriver;

  beforeEach(() => {
    driver = new ColumbusStateDriver();
  });

  it.each(HOST_STATUSES)(
    'should report %s when query state is %o',
    (status, query) => {
      expect(driver.get.hostStatus(query)).toBe(status);
    },
  );
});
