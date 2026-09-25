/** @jest-environment jsdom */
import { faker } from '@faker-js/faker';
import { aHostRuntimeConfig } from '@atlas/testkit';
import { DevelopmentSessionSourceDriver } from './development-session-source.driver.js';
import {
  discoverDevelopmentSession,
  readDismissedDevelopmentOffers,
  readStoredOverridesDocument,
} from './development-session-source.js';

describe('discoverDevelopmentSession', () => {
  let driver: DevelopmentSessionSourceDriver;

  beforeEach(() => {
    driver = new DevelopmentSessionSourceDriver();
  });

  describe('when the runtime names a development session URL', () => {
    const developmentSessionUrl = faker.internet.url();
    const runtime = aHostRuntimeConfig({ developmentSessionUrl });

    it('should fetch the session from that URL when discovered', async () => {
      driver.given.fetchedSession({});

      await discoverDevelopmentSession({
        runtime,
        dependencies: driver.get.dependencies(),
      });

      expect(driver.get.fetchJsonMock()).toHaveBeenCalledWith({
        url: developmentSessionUrl,
        runtime,
      });
    });

    it('should return the fetched session when discovered', async () => {
      const session = { hostId: runtime.hostId };

      driver.given.fetchedSession(session);

      await expect(
        discoverDevelopmentSession({
          runtime,
          dependencies: driver.get.dependencies(),
        }),
      ).resolves.toBe(session);
    });

    it('should not ask the bridge when discovered', async () => {
      driver.given.fetchedSession({});

      await discoverDevelopmentSession({
        runtime,
        dependencies: driver.get.dependencies(),
      });

      expect(driver.get.requestDevelopmentSessionMock()).not.toHaveBeenCalled();
    });
  });

  describe('when the runtime names no development session URL', () => {
    const runtime = aHostRuntimeConfig({ developmentSessionUrl: undefined });

    it('should ask the bridge for the runtime host when discovered', async () => {
      driver.given.bridgeSession(undefined);

      await discoverDevelopmentSession({
        runtime,
        dependencies: driver.get.dependencies(),
      });

      expect(driver.get.requestDevelopmentSessionMock()).toHaveBeenCalledWith({
        hostId: runtime.hostId,
      });
    });

    it('should return the bridge session when discovered', async () => {
      const session = { hostId: runtime.hostId };

      driver.given.bridgeSession(session);

      await expect(
        discoverDevelopmentSession({
          runtime,
          dependencies: driver.get.dependencies(),
        }),
      ).resolves.toBe(session);
    });
  });
});

describe('readStoredOverridesDocument', () => {
  let driver: DevelopmentSessionSourceDriver;

  beforeEach(() => {
    driver = new DevelopmentSessionSourceDriver();
  });

  it('should return null when neither storage holds a document', () => {
    expect(readStoredOverridesDocument(driver.get.dependencies())).toBeNull();
  });

  it('should return the session storage document when both storages hold one', () => {
    const value = faker.lorem.word();

    driver.given
      .sessionStorageItem('atlas.runtime-overrides', value)
      .given.localStorageItem('atlas.runtime-overrides', faker.lorem.word());

    expect(readStoredOverridesDocument(driver.get.dependencies())).toBe(value);
  });

  it('should return the local storage document when session storage is empty', () => {
    const value = faker.lorem.word();

    driver.given.localStorageItem('atlas.runtime-overrides', value);

    expect(readStoredOverridesDocument(driver.get.dependencies())).toBe(value);
  });
});

describe('readDismissedDevelopmentOffers', () => {
  let driver: DevelopmentSessionSourceDriver;

  beforeEach(() => {
    driver = new DevelopmentSessionSourceDriver();
  });

  it('should return null when neither storage holds dismissed offers for the host', () => {
    expect(
      readDismissedDevelopmentOffers({
        hostId: faker.string.uuid(),
        dependencies: driver.get.dependencies(),
      }),
    ).toBeNull();
  });

  it('should return the session storage value when both storages hold dismissed offers for the host', () => {
    const hostId = faker.string.uuid();
    const value = faker.lorem.word();

    driver.given
      .sessionStorageItem(`atlas.dismissed-development-offers.${hostId}`, value)
      .given.localStorageItem(
        `atlas.dismissed-development-offers.${hostId}`,
        faker.lorem.word(),
      );

    expect(
      readDismissedDevelopmentOffers({
        hostId,
        dependencies: driver.get.dependencies(),
      }),
    ).toBe(value);
  });

  it('should return the local storage value when only local storage holds dismissed offers for the host', () => {
    const hostId = faker.string.uuid();
    const value = faker.lorem.word();

    driver.given.localStorageItem(
      `atlas.dismissed-development-offers.${hostId}`,
      value,
    );

    expect(
      readDismissedDevelopmentOffers({
        hostId,
        dependencies: driver.get.dependencies(),
      }),
    ).toBe(value);
  });
});
