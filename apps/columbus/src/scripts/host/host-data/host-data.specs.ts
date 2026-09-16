import { aHostData } from '../../../types/host-data.testkit';
import { HostDataDriver } from './host-data.driver';

const PERSISTED = {
  schemaVersion: '1' as const,
  hostId: 'shop',
  overrides: [],
  generatedAt: '2026-01-01T00:00:00.000Z',
};

describe('readHostData', () => {
  let driver: HostDataDriver;

  beforeEach(() => {
    driver = new HostDataDriver();
  });

  it('should return the inspected host tab id when a host tab is found', async () => {
    await driver.when.hostDataRead();

    expect(driver.get.result()?.tabId).toBe(7);
  });

  it('should fill in persisted overrides when the page reports none', async () => {
    await driver.given.persistedOverrides(PERSISTED).when.hostDataRead();

    expect(driver.get.result()?.hostData.overrides).toBe(PERSISTED);
  });

  it('should keep the page overrides when the page reports them', async () => {
    const pageOverrides = { ...PERSISTED, hostId: 'from-page' };

    await driver.given
      .hostData(aHostData({ overrides: pageOverrides }))
      .given.persistedOverrides(PERSISTED)
      .when.hostDataRead();

    expect(driver.get.result()?.hostData.overrides).toBe(pageOverrides);
  });

  it('should cache the host data for the tab when read', async () => {
    await driver.when.hostDataRead();

    expect(driver.get.cachedSnapshot()).toMatchObject({
      tabId: 7,
      tabUrl: 'https://shop.example/',
    });
  });

  it('should still return host data when caching fails', async () => {
    await driver.given.cacheWriteFailure().when.hostDataRead();

    expect(driver.get.result()?.tabId).toBe(7);
  });

  it('should fail when no host tab is found', async () => {
    await driver.given.noHostTab('No tab.').when.hostDataRead();

    expect(driver.get.error()).toEqual(new Error('No tab.'));
  });
});
