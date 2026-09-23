import { faker } from '@faker-js/faker';
import { aHostData } from '../../testkit/host-data.testkit';
import { HostDataDriver } from './host-data.driver';

const { readHostData } = await import('./host-data');

describe('readHostData', () => {
  let driver: HostDataDriver;

  beforeEach(() => {
    driver = new HostDataDriver();
  });

  it('should reject when no host tab is found', async () => {
    const reason = faker.lorem.sentence();

    driver.given.hostTabFailure(new Error(reason));

    await expect(readHostData()).rejects.toThrow(reason);
  });

  describe('when a host tab is found', () => {
    const tab = { id: faker.number.int(), url: faker.internet.url() };

    it('should return the host data and tab id when read', async () => {
      const hostData = aHostData();

      driver.given.hostTab({ tab, hostData });

      await expect(readHostData()).resolves.toStrictEqual({
        hostData,
        tabId: tab.id,
      });
    });

    it('should cache the host data for the tab when read', async () => {
      const hostData = aHostData();

      driver.given.hostTab({ tab, hostData });

      await readHostData();

      expect(driver.get.writeHostDataCache()).toHaveBeenCalledWith({
        hostData,
        tabId: tab.id,
        tabUrl: tab.url,
      });
    });

    it('should return the host data and tab id when caching fails', async () => {
      const hostData = aHostData();

      driver.given
        .hostTab({ tab, hostData })
        .given.cacheWriteFailure(new Error(faker.lorem.sentence()));

      await expect(readHostData()).resolves.toStrictEqual({
        hostData,
        tabId: tab.id,
      });
    });

    it('should fill in the persisted overrides when the page reports none', async () => {
      const persisted = {
        schemaVersion: '1' as const,
        hostId: faker.string.uuid(),
        overrides: [],
        generatedAt: faker.date.recent().toISOString(),
      };

      driver.given
        .hostTab({ tab, hostData: aHostData({ overrides: undefined }) })
        .given.persistedOverrideDocument(persisted);

      expect((await readHostData()).hostData.overrides).toBe(persisted);
    });

    it('should keep the page overrides when the page reports them', async () => {
      const pageOverrides = {
        schemaVersion: '1' as const,
        hostId: faker.string.uuid(),
        overrides: [],
        generatedAt: faker.date.recent().toISOString(),
      };

      driver.given
        .hostTab({ tab, hostData: aHostData({ overrides: pageOverrides }) })
        .given.persistedOverrideDocument({
          ...pageOverrides,
          hostId: faker.string.uuid(),
        });

      expect((await readHostData()).hostData.overrides).toBe(pageOverrides);
    });
  });
});
