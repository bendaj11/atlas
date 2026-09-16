import { faker } from '@faker-js/faker';
import { HostDataDriver } from './host-data.driver.js';

describe('updateAtlasHostData', () => {
  let driver: HostDataDriver;

  beforeEach(() => {
    driver = new HostDataDriver();
  });

  it('should replace only the given fields when host data is updated', () => {
    const projectId = faker.string.uuid();
    const userId = faker.string.uuid();
    driver.given.hostData({ projectId, userId: null });

    driver.when.hostDataUpdated({ userId });

    expect(driver.get.hostData()).toMatchObject({ projectId, userId });
  });

  describe('when a listener is subscribed', () => {
    beforeEach(() => {
      driver.given.hostData({ projectId: faker.string.uuid(), userId: null });

      driver.when.subscribed();
    });

    it('should call the listener when host data is updated', () => {
      driver.when.hostDataUpdated({ userId: faker.string.uuid() });

      expect(driver.get.listenerMock()).toHaveBeenCalledTimes(1);
    });

    it('should not call the listener when host data is updated after unsubscribing', () => {
      driver.when.unsubscribed();
      driver.when.hostDataUpdated({ userId: faker.string.uuid() });

      expect(driver.get.listenerMock()).not.toHaveBeenCalled();
    });
  });
});
