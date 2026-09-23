import { faker } from '@faker-js/faker';
import { aHostData } from '../../testkit/host-data.testkit';
import {
  clearHostDataCache,
  readHostDataCache,
  writeHostDataCache,
} from './host-data-cache';
import { HostDataCacheDriver } from './host-data-cache.driver';

describe('readHostDataCache', () => {
  let driver: HostDataCacheDriver;

  beforeEach(() => {
    driver = new HostDataCacheDriver();
  });

  it('should return nothing when no snapshot is stored for the active tab', async () => {
    driver.given.tabs([
      { id: faker.number.int(), active: true, url: faker.internet.url() },
    ]);

    expect(await readHostDataCache()).toBeUndefined();
  });

  it('should return nothing when the stored value of the active tab is not a snapshot', async () => {
    const tabId = faker.number.int();

    driver.given
      .tabs([{ id: tabId, active: true, url: faker.internet.url() }])
      .given.sessionStorageItem(`atlas.host-data-cache.${tabId}`, {
        tabId: faker.word.noun(),
      });

    expect(await readHostDataCache()).toBeUndefined();
  });

  it('should return the host data and tab id when the active tab is unchanged since it was cached', async () => {
    const snapshot = {
      hostData: aHostData(),
      tabId: faker.number.int(),
      tabUrl: faker.internet.url(),
    };

    driver.given
      .tabs([{ id: snapshot.tabId, active: true, url: snapshot.tabUrl }])
      .given.sessionStorageItem(
        `atlas.host-data-cache.${snapshot.tabId}`,
        snapshot,
      );

    expect(await readHostDataCache()).toStrictEqual({
      hostData: snapshot.hostData,
      tabId: snapshot.tabId,
    });
  });

  it('should keep the snapshot of an inactive tab when another web tab is active', async () => {
    const snapshot = {
      hostData: aHostData(),
      tabId: faker.number.int(),
      tabUrl: faker.internet.url(),
    };

    driver.given
      .tabs([
        { id: snapshot.tabId, url: snapshot.tabUrl },
        { id: faker.number.int(), active: true, url: faker.internet.url() },
      ])
      .given.sessionStorageItem(
        `atlas.host-data-cache.${snapshot.tabId}`,
        snapshot,
      );

    await readHostDataCache();

    expect(
      driver.get.sessionStorageItem(`atlas.host-data-cache.${snapshot.tabId}`),
    ).toStrictEqual(snapshot);
  });

  describe('when the active tab navigated since it was cached', () => {
    const snapshot = {
      hostData: aHostData(),
      tabId: faker.number.int(),
      tabUrl: faker.internet.url(),
    };

    beforeEach(() => {
      driver.given
        .tabs([{ id: snapshot.tabId, active: true, url: faker.internet.url() }])
        .given.sessionStorageItem(
          `atlas.host-data-cache.${snapshot.tabId}`,
          snapshot,
        );
    });

    it('should return nothing when read', async () => {
      expect(await readHostDataCache()).toBeUndefined();
    });

    it('should drop the snapshot of the tab when read', async () => {
      await readHostDataCache();

      expect(
        driver.get.sessionStorageItem(
          `atlas.host-data-cache.${snapshot.tabId}`,
        ),
      ).toBeUndefined();
    });
  });

  describe('when an extension page is active', () => {
    const extensionPage = {
      id: faker.number.int(),
      active: true,
      url: `chrome-extension://${faker.string.alphanumeric(8)}/index.html`,
    };

    it('should return the host data and tab id of the cached web tab when it is unchanged', async () => {
      const snapshot = {
        hostData: aHostData(),
        tabId: faker.number.int(),
        tabUrl: faker.internet.url(),
      };

      driver.given
        .tabs([extensionPage, { id: snapshot.tabId, url: snapshot.tabUrl }])
        .given.sessionStorageItem(
          `atlas.host-data-cache.${snapshot.tabId}`,
          snapshot,
        );

      expect(await readHostDataCache()).toStrictEqual({
        hostData: snapshot.hostData,
        tabId: snapshot.tabId,
      });
    });

    it('should return the tab id of the most recently accessed cached web tab when several are cached', async () => {
      const older = {
        hostData: aHostData(),
        tabId: faker.number.int(),
        tabUrl: faker.internet.url(),
      };
      const recent = {
        hostData: aHostData(),
        tabId: faker.number.int(),
        tabUrl: faker.internet.url(),
      };

      driver.given
        .tabs([
          extensionPage,
          { id: older.tabId, url: older.tabUrl, lastAccessed: 1 },
          { id: recent.tabId, url: recent.tabUrl, lastAccessed: 2 },
        ])
        .given.sessionStorageItem(`atlas.host-data-cache.${older.tabId}`, older)
        .given.sessionStorageItem(
          `atlas.host-data-cache.${recent.tabId}`,
          recent,
        );

      expect(await readHostDataCache()).toHaveProperty('tabId', recent.tabId);
    });
  });
});

describe('writeHostDataCache', () => {
  let driver: HostDataCacheDriver;

  beforeEach(() => {
    driver = new HostDataCacheDriver();
  });

  it('should store the snapshot without the page state under the key of its tab when written', async () => {
    const hostData = aHostData({
      visibleAppIds: [faker.string.uuid()],
      runtimeErrors: [{ message: faker.lorem.sentence() }],
    });
    const { visibleAppIds, runtimeErrors, ...cachedHostData } = hostData;
    const tabId = faker.number.int();
    const tabUrl = faker.internet.url();

    await writeHostDataCache({ hostData, tabId, tabUrl });

    expect(
      driver.get.sessionStorageItem(`atlas.host-data-cache.${tabId}`),
    ).toStrictEqual({ hostData: cachedHostData, tabId, tabUrl });
  });
});

describe('clearHostDataCache', () => {
  let driver: HostDataCacheDriver;

  beforeEach(() => {
    driver = new HostDataCacheDriver();
  });

  describe('when a snapshot is stored', () => {
    const snapshot = {
      hostData: aHostData(),
      tabId: faker.number.int(),
      tabUrl: faker.internet.url(),
    };

    beforeEach(() => {
      driver.given.sessionStorageItem(
        `atlas.host-data-cache.${snapshot.tabId}`,
        snapshot,
      );
    });

    it('should drop the snapshot when cleared for its tab', async () => {
      await clearHostDataCache(snapshot.tabId);

      expect(
        driver.get.sessionStorageItem(
          `atlas.host-data-cache.${snapshot.tabId}`,
        ),
      ).toBeUndefined();
    });

    it('should keep the snapshot when cleared for another tab', async () => {
      await clearHostDataCache(faker.number.int());

      expect(
        driver.get.sessionStorageItem(
          `atlas.host-data-cache.${snapshot.tabId}`,
        ),
      ).toStrictEqual(snapshot);
    });
  });
});
