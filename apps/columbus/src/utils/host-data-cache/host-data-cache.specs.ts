import { faker } from '@faker-js/faker';
import { aHostData } from '../../testkit/host-data.testkit';
import {
  clearHostDataCache,
  readHostDataCache,
  writeHostDataCache,
} from './host-data-cache';
import { HostDataCacheDriver } from './host-data-cache.driver';

const CACHE_KEY = 'atlas.host-data-cache';

describe('readHostDataCache', () => {
  let driver: HostDataCacheDriver;

  beforeEach(() => {
    driver = new HostDataCacheDriver();
  });

  it('should return nothing when no snapshot is stored', async () => {
    expect(await readHostDataCache()).toBeUndefined();
  });

  it('should return nothing when the stored value is not a snapshot', async () => {
    driver.given.sessionStorageItem(CACHE_KEY, { tabId: faker.word.noun() });

    expect(await readHostDataCache()).toBeUndefined();
  });

  it('should return the host data and tab id when the cached tab is active and unchanged', async () => {
    const snapshot = {
      hostData: aHostData(),
      tabId: faker.number.int(),
      tabUrl: faker.internet.url(),
    };

    driver.given
      .tabs([{ id: snapshot.tabId, active: true, url: snapshot.tabUrl }])
      .given.sessionStorageItem(CACHE_KEY, snapshot);

    expect(await readHostDataCache()).toStrictEqual({
      hostData: snapshot.hostData,
      tabId: snapshot.tabId,
    });
  });

  it('should return the host data and tab id when an extension page is active and the cached tab is unchanged', async () => {
    const snapshot = {
      hostData: aHostData(),
      tabId: faker.number.int(),
      tabUrl: faker.internet.url(),
    };

    driver.given
      .tabs([
        {
          id: faker.number.int(),
          active: true,
          url: `chrome-extension://${faker.string.alphanumeric(8)}/index.html`,
        },
        { id: snapshot.tabId, url: snapshot.tabUrl },
      ])
      .given.sessionStorageItem(CACHE_KEY, snapshot);

    expect(await readHostDataCache()).toStrictEqual({
      hostData: snapshot.hostData,
      tabId: snapshot.tabId,
    });
  });

  it('should return nothing when the cached tab navigated elsewhere', async () => {
    const snapshot = {
      hostData: aHostData(),
      tabId: faker.number.int(),
      tabUrl: faker.internet.url(),
    };

    driver.given
      .tabs([{ id: snapshot.tabId, active: true, url: faker.internet.url() }])
      .given.sessionStorageItem(CACHE_KEY, snapshot);

    expect(await readHostDataCache()).toBeUndefined();
  });

  describe('when another web tab is active', () => {
    const snapshot = {
      hostData: aHostData(),
      tabId: faker.number.int(),
      tabUrl: faker.internet.url(),
    };

    beforeEach(() => {
      driver.given
        .tabs([
          { id: snapshot.tabId, url: snapshot.tabUrl },
          { id: faker.number.int(), active: true, url: faker.internet.url() },
        ])
        .given.sessionStorageItem(CACHE_KEY, snapshot);
    });

    it('should return nothing when read', async () => {
      expect(await readHostDataCache()).toBeUndefined();
    });

    it('should drop the stored snapshot when read', async () => {
      await readHostDataCache();

      expect(driver.get.sessionStorageItem(CACHE_KEY)).toBeUndefined();
    });
  });
});

describe('writeHostDataCache', () => {
  let driver: HostDataCacheDriver;

  beforeEach(() => {
    driver = new HostDataCacheDriver();
  });

  it('should store the snapshot when written', async () => {
    const snapshot = {
      hostData: aHostData(),
      tabId: faker.number.int(),
      tabUrl: faker.internet.url(),
    };

    await writeHostDataCache(snapshot);

    expect(driver.get.sessionStorageItem(CACHE_KEY)).toStrictEqual(snapshot);
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
      driver.given.sessionStorageItem(CACHE_KEY, snapshot);
    });

    it('should drop the snapshot when cleared without a tab', async () => {
      await clearHostDataCache();

      expect(driver.get.sessionStorageItem(CACHE_KEY)).toBeUndefined();
    });

    it('should drop the snapshot when cleared for its tab', async () => {
      await clearHostDataCache(snapshot.tabId);

      expect(driver.get.sessionStorageItem(CACHE_KEY)).toBeUndefined();
    });

    it('should keep the snapshot when cleared for another tab', async () => {
      await clearHostDataCache(faker.number.int());

      expect(driver.get.sessionStorageItem(CACHE_KEY)).toStrictEqual(snapshot);
    });
  });
});
