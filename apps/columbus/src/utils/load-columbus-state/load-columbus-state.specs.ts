import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { aHostData } from '../../testkit/host-data.testkit';
import { LoadColumbusStateDriver } from './load-columbus-state.driver';

const { loadColumbusState } = await import('./load-columbus-state');

describe('loadColumbusState', () => {
  let driver: LoadColumbusStateDriver;

  beforeEach(() => {
    driver = new LoadColumbusStateDriver();
  });

  describe('when a cached host exists', () => {
    const cache = { hostData: aHostData(), tabId: faker.number.int() };

    beforeEach(() => {
      driver.given.hostDataCache(cache);
    });

    it('should resolve with the cached tab id when no columbusState exists', async () => {
      await expect(loadColumbusState(false)).resolves.toHaveProperty(
        'tabId',
        cache.tabId,
      );
    });

    it('should not read the active tab when no columbusState exists', async () => {
      await loadColumbusState(false);

      expect(driver.get.readHostData()).not.toHaveBeenCalled();
    });

    it('should not read the cache when a columbusState exists', async () => {
      driver.given.hostData({
        hostData: aHostData(),
        tabId: faker.number.int(),
      });

      await loadColumbusState(true);

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

      await expect(loadColumbusState(false)).resolves.toHaveProperty(
        'tabId',
        read.tabId,
      );
    });

    it('should resolve with the active tab id when the cache read fails', async () => {
      driver.given.hostDataCacheFailure(new Error(faker.lorem.sentence()));

      await expect(loadColumbusState(false)).resolves.toHaveProperty(
        'tabId',
        read.tabId,
      );
    });

    it('should resolve with the disabled overrides when loaded', async () => {
      const disabled = new Map([[faker.string.uuid(), anAppManifest()]]);
      driver.given.disabledArtifactVersionOverrides(disabled);

      await expect(loadColumbusState(false)).resolves.toHaveProperty(
        'disabledArtifactVersionOverrides',
        disabled,
      );
    });

    it('should resolve with the cleared local artifact ids when loaded', async () => {
      const cleared = new Set([faker.string.uuid()]);
      driver.given.clearedLocalArtifactIds(cleared);

      await expect(loadColumbusState(false)).resolves.toHaveProperty(
        'clearedLocalArtifactIds',
        cleared,
      );
    });

    it('should resolve with the disabled override apps added to the catalog when they are not deployed', async () => {
      const overrideApp = anAppManifest();
      driver.given.disabledArtifactVersionOverrides(
        new Map([[overrideApp.id, overrideApp]]),
      );

      await expect(loadColumbusState(false)).resolves.toHaveProperty(
        'hostData.catalog.apps',
        [overrideApp],
      );
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

      await expect(loadColumbusState(false)).resolves.toHaveProperty(
        'scope',
        scope,
      );
    },
  );

  it('should read the disabled overrides of the host tab and scope when loaded', async () => {
    const read = {
      hostData: aHostData({ overrideScope: 'tab' }),
      tabId: faker.number.int(),
    };
    driver.given.hostData(read);

    await loadColumbusState(false);

    expect(
      driver.get.readDisabledArtifactVersionOverrides(),
    ).toHaveBeenCalledWith({
      hostId: read.hostData.config.hostId,
      tabId: read.tabId,
      scope: 'tab',
    });
  });

  it('should read the cleared local artifact ids of the host tab and scope when loaded', async () => {
    const read = {
      hostData: aHostData({ overrideScope: 'tab' }),
      tabId: faker.number.int(),
    };
    driver.given.hostData(read);

    await loadColumbusState(false);

    expect(driver.get.readClearedLocalArtifactIds()).toHaveBeenCalledWith({
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

    await expect(loadColumbusState(false)).resolves.toHaveProperty(
      'enabledArtifactVersionOverrides',
      new Map([[override.id, override]]),
    );
  });

  describe('when the active tab read fails', () => {
    const reason = faker.lorem.sentence();

    beforeEach(() => {
      driver.given.hostDataFailure(new Error(reason));
    });

    it('should reject with the failure reason when loaded', async () => {
      await expect(loadColumbusState(false)).rejects.toThrow(reason);
    });

    it('should reject with a retry hint when loaded', async () => {
      await expect(loadColumbusState(false)).rejects.toThrow('then retry.');
    });
  });
});
