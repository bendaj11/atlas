import { faker } from '@faker-js/faker';
import { aHostRuntimeConfig } from '@atlas/testkit';
import { DevelopmentSessionSourceDriver } from './development-session-source.driver.js';

describe('discoverDevelopmentSession', () => {
  let driver: DevelopmentSessionSourceDriver;

  beforeEach(() => {
    driver = new DevelopmentSessionSourceDriver();
  });

  describe('when the runtime names a development session URL', () => {
    const developmentSessionUrl = 'http://localhost:4400/session.json';
    const runtime = aHostRuntimeConfig({ developmentSessionUrl });

    it('should fetch the session from that URL when discovered', async () => {
      driver.given.fetchedSession({});
      await driver.when.discovered(runtime);

      expect(driver.get.fetchJsonMock()).toHaveBeenCalledWith({
        url: developmentSessionUrl,
        runtime,
      });
    });

    it('should return the fetched session when discovered', async () => {
      const session = { hostId: runtime.hostId };
      driver.given.fetchedSession(session);
      await driver.when.discovered(runtime);

      expect(driver.get.discovered()).toBe(session);
    });

    it('should not ask the bridge when discovered', async () => {
      driver.given.fetchedSession({});
      await driver.when.discovered(runtime);

      expect(driver.get.requestDevelopmentSessionMock()).not.toHaveBeenCalled();
    });
  });

  describe('when the runtime names no development session URL', () => {
    const runtime = aHostRuntimeConfig();

    it('should ask the bridge for the runtime host when discovered', async () => {
      driver.given.bridgeSession(undefined);
      await driver.when.discovered(runtime);

      expect(driver.get.requestDevelopmentSessionMock()).toHaveBeenCalledWith({
        hostId: runtime.hostId,
      });
    });

    it('should return the bridge session when discovered', async () => {
      const session = { hostId: runtime.hostId };
      driver.given.bridgeSession(session);
      await driver.when.discovered(runtime);

      expect(driver.get.discovered()).toBe(session);
    });
  });
});

describe('storeDevelopmentSession', () => {
  let driver: DevelopmentSessionSourceDriver;

  beforeEach(() => {
    driver = new DevelopmentSessionSourceDriver();
  });

  it('should write the serialized session to session storage when stored', () => {
    const session = { hostId: faker.string.uuid() };
    driver.when.sessionStored(session);

    expect(driver.get.sessionStorageValue()).toBe(JSON.stringify(session));
  });

  it('should return the serialized session when stored', () => {
    const session = { hostId: faker.string.uuid() };
    driver.when.sessionStored(session);

    expect(driver.get.stored()).toBe(JSON.stringify(session));
  });
});

describe('storedOverridesDocument', () => {
  let driver: DevelopmentSessionSourceDriver;

  beforeEach(() => {
    driver = new DevelopmentSessionSourceDriver();
  });

  it('should return null when neither storage holds a document', () => {
    driver.when.documentRead();

    expect(driver.get.stored()).toBeNull();
  });

  it('should return the session storage document when both storages hold one', () => {
    const value = faker.lorem.word();
    driver.given
      .sessionStorageValue(value)
      .given.localStorageValue(faker.lorem.word())
      .when.documentRead();

    expect(driver.get.stored()).toBe(value);
  });

  it('should return the local storage document when session storage is empty', () => {
    const value = faker.lorem.word();
    driver.given.localStorageValue(value).when.documentRead();

    expect(driver.get.stored()).toBe(value);
  });
});
