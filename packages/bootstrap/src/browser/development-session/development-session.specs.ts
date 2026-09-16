import { faker } from '@faker-js/faker';
import {
  ATLAS_DEV_SESSION_REQUEST,
  ATLAS_DEV_SESSION_RESPONSE,
} from '@atlas/schema';
import { DevelopmentSessionDriver } from './development-session.driver.js';

describe('requestDevelopmentSession', () => {
  let driver: DevelopmentSessionDriver;

  beforeEach(() => {
    driver = new DevelopmentSessionDriver();
  });

  describe('when the bridge marker is absent', () => {
    beforeEach(async () => {
      driver.given
        .bridgeMarkerPresent(false)
        .when.requested(faker.string.uuid());
      await driver.when.settled();
    });

    it('should resolve undefined when requested', () => {
      expect(driver.get.result()).toBeUndefined();
    });

    it('should not post a request when requested', () => {
      expect(driver.get.postMessageMock()).not.toHaveBeenCalled();
    });
  });

  describe('when the bridge marker is present', () => {
    const hostId = faker.string.uuid();
    const requestId = faker.string.uuid();
    const origin = faker.internet.url();

    beforeEach(() => {
      driver.given
        .bridgeMarkerPresent(true)
        .given.requestId(requestId)
        .given.origin(origin);
    });

    it('should post the session request to the page origin when requested', async () => {
      driver.when.requested(hostId);

      expect(driver.get.postMessageMock()).toHaveBeenCalledWith(
        { type: ATLAS_DEV_SESSION_REQUEST, requestId, hostId },
        origin,
      );
    });

    it('should resolve the document when the bridge replies to this request', async () => {
      const document = {
        hostId,
        generatedAt: faker.date.recent().toISOString(),
      };
      driver.given.bridgeReply({
        type: ATLAS_DEV_SESSION_RESPONSE,
        requestId,
        hostId,
        document,
      });
      driver.when.requested(hostId);
      await driver.when.settled();

      expect(driver.get.result()).toBe(document);
    });

    it('should stop listening when the bridge replies to this request', async () => {
      driver.given.bridgeReply({
        type: ATLAS_DEV_SESSION_RESPONSE,
        requestId,
        hostId,
        document: {},
      });
      driver.when.requested(hostId);
      await driver.when.settled();

      expect(driver.get.removeEventListenerMock()).toHaveBeenCalledTimes(1);
    });

    it('should resolve undefined when the bridge does not reply before the timeout', async () => {
      driver.when.requested(hostId);
      await driver.when.timedOut();

      expect(driver.get.result()).toBeUndefined();
    });

    it('should ignore a reply for another request when the timeout fires', async () => {
      driver.given.bridgeReply({
        type: ATLAS_DEV_SESSION_RESPONSE,
        requestId: faker.string.uuid(),
        hostId,
        document: {},
      });
      driver.when.requested(hostId);
      await driver.when.timedOut();

      expect(driver.get.result()).toBeUndefined();
    });

    it('should ignore a reply for another host when the timeout fires', async () => {
      driver.given.bridgeReply({
        type: ATLAS_DEV_SESSION_RESPONSE,
        requestId,
        hostId: faker.string.uuid(),
        document: {},
      });
      driver.when.requested(hostId);
      await driver.when.timedOut();

      expect(driver.get.result()).toBeUndefined();
    });

    it('should ignore a reply carrying an error when the timeout fires', async () => {
      driver.given.bridgeReply({
        type: ATLAS_DEV_SESSION_RESPONSE,
        requestId,
        hostId,
        error: faker.lorem.sentence(),
      });
      driver.when.requested(hostId);
      await driver.when.timedOut();

      expect(driver.get.result()).toBeUndefined();
    });
  });
});
