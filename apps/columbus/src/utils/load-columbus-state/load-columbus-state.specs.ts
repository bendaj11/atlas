import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { aHostData } from '../../testkit/host-data.testkit';
import type { DevelopmentOffers } from '../../types/host-data';
import { LoadColumbusStateDriver } from './load-columbus-state.driver';

const { loadColumbusState } = await import('./load-columbus-state');

describe('loadColumbusState', () => {
  let driver: LoadColumbusStateDriver;

  beforeEach(() => {
    driver = new LoadColumbusStateDriver();
  });

  describe('when a cached host exists and its page state is read', () => {
    const cache = { hostData: aHostData(), tabId: faker.number.int() };
    const pageState = {
      visibleAppIds: [faker.string.uuid()],
      runtimeErrors: [{ message: faker.lorem.sentence() }],
    };

    beforeEach(() => {
      driver.given.hostDataCache(cache).given.pageState(pageState);
    });

    it('should resolve with the cached tab id when no columbusState exists', async () => {
      await expect(
        loadColumbusState({ bypassCache: false }),
      ).resolves.toHaveProperty('tabId', cache.tabId);
    });

    it('should not read the active tab when no columbusState exists', async () => {
      await loadColumbusState({ bypassCache: false });

      expect(driver.get.readHostData()).not.toHaveBeenCalled();
    });

    it('should read the page state of the cached tab when the cache is not bypassed', async () => {
      await loadColumbusState({ bypassCache: false });

      expect(driver.get.readPageStateFromHostTab()).toHaveBeenCalledWith(
        cache.tabId,
      );
    });

    it('should resolve with the live visible app ids when the cache is not bypassed', async () => {
      const columbusState = await loadColumbusState({ bypassCache: false });

      expect(columbusState.hostData.visibleAppIds).toStrictEqual(
        pageState.visibleAppIds,
      );
    });

    it('should resolve with the live runtime errors when the cache is not bypassed', async () => {
      const columbusState = await loadColumbusState({ bypassCache: false });

      expect(columbusState.hostData.runtimeErrors).toStrictEqual(
        pageState.runtimeErrors,
      );
    });

    it('should not read the cache when a columbusState exists', async () => {
      driver.given.hostData({
        hostData: aHostData(),
        tabId: faker.number.int(),
      });

      await loadColumbusState({ bypassCache: true });

      expect(driver.get.readHostDataCache()).not.toHaveBeenCalled();
    });
  });

  describe('when the active tab is read', () => {
    const read = { hostData: aHostData(), tabId: faker.number.int() };

    beforeEach(() => {
      driver.given.hostData(read);
    });

    it('should resolve with the active tab id when no cached host exists', async () => {
      driver.given.hostDataCache(undefined);

      await expect(
        loadColumbusState({ bypassCache: false }),
      ).resolves.toHaveProperty('tabId', read.tabId);
    });

    it('should resolve with the active tab id when the cache read fails', async () => {
      driver.given.hostDataCacheFailure(new Error(faker.lorem.sentence()));

      await expect(
        loadColumbusState({ bypassCache: false }),
      ).resolves.toHaveProperty('tabId', read.tabId);
    });

    it('should resolve with the active tab id when the page state of the cached tab cannot be read', async () => {
      driver.given
        .hostDataCache({ hostData: aHostData(), tabId: faker.number.int() })
        .given.pageStateFailure(new Error(faker.lorem.sentence()));

      await expect(
        loadColumbusState({ bypassCache: false }),
      ).resolves.toHaveProperty('tabId', read.tabId);
    });

    it('should resolve with the active tab id when the cached host overrides cannot be read', async () => {
      driver.given
        .hostDataCache({ hostData: aHostData(), tabId: faker.number.int() })
        .given.pageState({ visibleAppIds: [], runtimeErrors: [] })
        .given.disabledArtifactVersionOverridesFailure(
          new Error(faker.lorem.sentence()),
        );

      await expect(
        loadColumbusState({ bypassCache: false }),
      ).resolves.toHaveProperty('tabId', read.tabId);
    });

    it('should resolve with the disabled overrides when loaded', async () => {
      const disabled = new Map([[faker.string.uuid(), anAppManifest()]]);
      driver.given.disabledArtifactVersionOverrides(disabled);

      await expect(
        loadColumbusState({ bypassCache: false }),
      ).resolves.toHaveProperty('disabledArtifactVersionOverrides', disabled);
    });

    it('should resolve with the disabled override apps added to the catalog when they are not deployed', async () => {
      const overrideApp = anAppManifest();
      driver.given.disabledArtifactVersionOverrides(
        new Map([[overrideApp.id, overrideApp]]),
      );

      await expect(
        loadColumbusState({ bypassCache: false }),
      ).resolves.toHaveProperty('hostData.catalog.apps', [overrideApp]);
    });
  });

  it.each([
    ['tab', 'tab'],
    ['all', 'all'],
    [undefined, 'all'],
  ] as const)(
    'should resolve with scope %s when the host override scope is %s',
    async (overrideScope, scope) => {
      const read = {
        hostData: aHostData({ overrideScope }),
        tabId: faker.number.int(),
      };
      driver.given.hostData(read);

      await expect(
        loadColumbusState({ bypassCache: false }),
      ).resolves.toHaveProperty('scope', scope);
    },
  );

  it('should read the disabled overrides of the host tab and scope when loaded', async () => {
    const read = {
      hostData: aHostData({ overrideScope: 'tab' }),
      tabId: faker.number.int(),
    };
    driver.given.hostData(read);

    await loadColumbusState({ bypassCache: false });

    expect(
      driver.get.readDisabledArtifactVersionOverrides(),
    ).toHaveBeenCalledWith({
      hostId: read.hostData.config.hostId,
      tabId: read.tabId,
      scope: 'tab',
    });
  });

  it('should resolve with the enabled overrides of the override document when loaded', async () => {
    const override = anAppManifest();
    const read = {
      hostData: aHostData({
        overrides: {
          schemaVersion: '1',
          hostId: faker.string.uuid(),
          overrides: [
            { appId: override.id, manifest: override, reason: 'local' },
          ],
          generatedAt: faker.date.recent().toISOString(),
        },
      }),
      tabId: faker.number.int(),
    };
    driver.given.hostData(read);

    await expect(
      loadColumbusState({ bypassCache: false }),
    ).resolves.toHaveProperty(
      'enabledArtifactVersionOverrides',
      new Map([[override.id, override]]),
    );
  });

  it('should resolve with the disabled overrides without the artifact enabled by the override document when loaded', async () => {
    const override = anAppManifest();
    const read = {
      hostData: aHostData({
        overrides: {
          schemaVersion: '1',
          hostId: faker.string.uuid(),
          overrides: [
            { appId: override.id, manifest: override, reason: 'local' },
          ],
          generatedAt: faker.date.recent().toISOString(),
        },
      }),
      tabId: faker.number.int(),
    };
    driver.given
      .hostData(read)
      .given.disabledArtifactVersionOverrides(
        new Map([[override.id, anAppManifest({ id: override.id })]]),
      );

    await expect(
      loadColumbusState({ bypassCache: false }),
    ).resolves.toHaveProperty('disabledArtifactVersionOverrides', new Map());
  });

  describe('when the active tab has a live development offer', () => {
    const offered = anAppManifest();
    const offerId = faker.string.uuid();
    const developmentOffers: DevelopmentOffers = {
      overrides: [{ appId: offered.id, manifest: offered, reason: 'local' }],
      offerIds: { [offered.id]: offerId },
    };

    it('should resolve with the offered build enabled when the offer is not dismissed', async () => {
      driver.given.hostData({
        hostData: aHostData({ developmentOffers, dismissedOfferIds: {} }),
        tabId: faker.number.int(),
      });

      await expect(
        loadColumbusState({ bypassCache: false }),
      ).resolves.toHaveProperty(
        'enabledArtifactVersionOverrides',
        new Map([[offered.id, offered]]),
      );
    });

    it('should resolve without the offered build enabled when the same offer is dismissed', async () => {
      driver.given.hostData({
        hostData: aHostData({
          developmentOffers,
          dismissedOfferIds: { [offered.id]: offerId },
        }),
        tabId: faker.number.int(),
      });

      await expect(
        loadColumbusState({ bypassCache: false }),
      ).resolves.toHaveProperty('enabledArtifactVersionOverrides', new Map());
    });

    it('should resolve with the offered build enabled when a previous offer of the artifact is dismissed', async () => {
      driver.given.hostData({
        hostData: aHostData({
          developmentOffers,
          dismissedOfferIds: { [offered.id]: faker.string.uuid() },
        }),
        tabId: faker.number.int(),
      });

      await expect(
        loadColumbusState({ bypassCache: false }),
      ).resolves.toHaveProperty(
        'enabledArtifactVersionOverrides',
        new Map([[offered.id, offered]]),
      );
    });

    it('should resolve with the disabled overrides without the offered artifact when the offer is not dismissed', async () => {
      driver.given
        .hostData({
          hostData: aHostData({ developmentOffers, dismissedOfferIds: {} }),
          tabId: faker.number.int(),
        })
        .given.disabledArtifactVersionOverrides(
          new Map([[offered.id, anAppManifest({ id: offered.id })]]),
        );

      await expect(
        loadColumbusState({ bypassCache: false }),
      ).resolves.toHaveProperty('disabledArtifactVersionOverrides', new Map());
    });
  });

  describe('when the active tab read fails', () => {
    const reason = faker.lorem.sentence();

    beforeEach(() => {
      driver.given.hostDataFailure(new Error(reason));
    });

    it('should reject with the failure reason when loaded', async () => {
      await expect(loadColumbusState({ bypassCache: false })).rejects.toThrow(
        reason,
      );
    });

    it('should reject with a retry hint when loaded', async () => {
      await expect(loadColumbusState({ bypassCache: false })).rejects.toThrow(
        'then retry.',
      );
    });
  });
});
