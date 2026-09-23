/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { DevelopmentSessionDriver } from './development-session.driver.js';

describe('requestDevelopmentSession', () => {
  let driver: DevelopmentSessionDriver;

  beforeEach(() => {
    driver = new DevelopmentSessionDriver();
  });

  afterEach(() => driver.dispose());

  it('should resolve the session document when the bridge answers the request', async () => {
    const sessionDocument = { hostId: faker.string.uuid() };
    await driver.given.sessionDocument(sessionDocument).when.requested();

    expect(driver.get.result()).toEqual(sessionDocument);
  });

  it('should resolve undefined when the bridge answers without a document', async () => {
    await driver.given.sessionDocument(undefined).when.requested();

    expect(driver.get.result()).toBeUndefined();
  });

  it('should resolve undefined without waiting when the bridge marker is absent', async () => {
    await driver.given
      .bridgeMarker(false)
      .given.bridgeResponding(false)
      .when.requested();

    expect(driver.get.result()).toBeUndefined();
  });
});
