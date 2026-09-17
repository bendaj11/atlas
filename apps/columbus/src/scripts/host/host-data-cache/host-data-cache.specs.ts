import { HostDataCacheDriver } from './host-data-cache.driver';

const HOST_URL = 'https://shop.example/';

describe('readHostDataCache', () => {
  let driver: HostDataCacheDriver;

  beforeEach(() => {
    driver = new HostDataCacheDriver();
  });

  it('should return nothing when no snapshot is stored', async () => {
    await driver.when.cacheRead();

    expect(driver.get.result()).toBeUndefined();
  });

  it('should return nothing when the stored value is not a snapshot', async () => {
    await driver.given.storedValue({ tabId: 'x' }).when.cacheRead();

    expect(driver.get.result()).toBeUndefined();
  });

  it('should return the snapshot when the cached tab is active and unchanged', async () => {
    await driver.given
      .tabs([{ id: 7, active: true, url: HOST_URL }])
      .given.cachedSnapshot(7, HOST_URL)
      .when.cacheRead();

    expect(driver.get.result()).toEqual({
      hostData: driver.get.hostData(),
      tabId: 7,
    });
  });

  it('should return the snapshot when the popup page is active and the cached tab is unchanged', async () => {
    await driver.given
      .tabs([
        { id: 1, active: true, url: 'chrome-extension://abc/index.html' },
        { id: 7, url: HOST_URL },
      ])
      .given.cachedSnapshot(7, HOST_URL)
      .when.cacheRead();

    expect(driver.get.result()?.tabId).toBe(7);
  });

  it('should return nothing when the cached tab navigated elsewhere', async () => {
    await driver.given
      .tabs([{ id: 7, active: true, url: 'https://other.example/' }])
      .given.cachedSnapshot(7, HOST_URL)
      .when.cacheRead();

    expect(driver.get.result()).toBeUndefined();
  });

  it('should return nothing when another web tab is active', async () => {
    await driver.given
      .tabs([
        { id: 7, url: HOST_URL },
        { id: 8, active: true, url: 'https://other.example/' },
      ])
      .given.cachedSnapshot(7, HOST_URL)
      .when.cacheRead();

    expect(driver.get.result()).toBeUndefined();
  });

  it('should drop the snapshot when it no longer matches the active host', async () => {
    await driver.given
      .tabs([{ id: 8, active: true, url: 'https://other.example/' }])
      .given.cachedSnapshot(7, HOST_URL)
      .when.cacheRead();

    expect(driver.get.storedSnapshot()).toBeUndefined();
  });
});

describe('writeHostDataCache', () => {
  let driver: HostDataCacheDriver;

  beforeEach(() => {
    driver = new HostDataCacheDriver();
  });

  it('should store the snapshot when written', async () => {
    await driver.when.cacheWritten(7, HOST_URL);

    expect(driver.get.storedSnapshot()).toEqual({
      hostData: driver.get.hostData(),
      tabId: 7,
      tabUrl: HOST_URL,
    });
  });
});

describe('clearHostDataCache', () => {
  let driver: HostDataCacheDriver;

  beforeEach(() => {
    driver = new HostDataCacheDriver();
  });

  it('should drop the snapshot when cleared without a tab', async () => {
    await driver.given.cachedSnapshot(7, HOST_URL).when.cacheCleared();

    expect(driver.get.storedSnapshot()).toBeUndefined();
  });

  it('should drop the snapshot when cleared for its tab', async () => {
    await driver.given.cachedSnapshot(7, HOST_URL).when.cacheCleared(7);

    expect(driver.get.storedSnapshot()).toBeUndefined();
  });

  it('should keep the snapshot when cleared for another tab', async () => {
    await driver.given.cachedSnapshot(7, HOST_URL).when.cacheCleared(8);

    expect(driver.get.storedSnapshot()).toBeDefined();
  });
});
