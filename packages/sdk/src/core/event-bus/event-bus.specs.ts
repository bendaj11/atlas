import { faker } from '@faker-js/faker';
import { AtlasError } from '@atlas/schema';
import { EventBusDriver } from './event-bus.driver.js';

describe('createAtlasEventBus', () => {
  let driver: EventBusDriver;

  beforeEach(() => {
    driver = new EventBusDriver();
  });

  describe('when a listener is added', () => {
    beforeEach(() => {
      driver.when.listenerAdded();
    });

    it('should call the listener with the payload when the event is emitted', () => {
      const orderId = faker.string.uuid();

      driver.when.orderUpdated(orderId);

      expect(driver.get.listenerMock()).toHaveBeenCalledWith({ orderId });
    });

    it('should not call the listener when the event is emitted after the listener is removed', () => {
      driver.when.listenerRemoved();
      driver.when.orderUpdated(faker.string.uuid());

      expect(driver.get.listenerMock()).not.toHaveBeenCalled();
    });
  });

  describe('when a once listener is added', () => {
    beforeEach(() => {
      driver.when.onceListenerAdded();
    });

    it('should call the listener once when the event is emitted twice', () => {
      driver.when.orderUpdated(faker.string.uuid());
      driver.when.orderUpdated(faker.string.uuid());

      expect(driver.get.listenerMock()).toHaveBeenCalledTimes(1);
    });

    it('should not call the listener when the once listener is cancelled before the event is emitted', () => {
      driver.when.onceListenerCancelled();
      driver.when.orderUpdated(faker.string.uuid());

      expect(driver.get.listenerMock()).not.toHaveBeenCalled();
    });
  });

  describe('when an earlier listener throws', () => {
    const failure = new Error('listener exploded');

    beforeEach(() => {
      driver.given.failingListener(failure).when.listenerAdded();
    });

    it('should still call the next listener when the event is emitted', () => {
      const orderId = faker.string.uuid();

      driver.when.orderUpdated(orderId);

      expect(driver.get.listenerMock()).toHaveBeenCalledWith({ orderId });
    });

    it('should rethrow the failure as an ATLAS_EVENT_LISTENER_FAILED error in a microtask when the event is emitted', () => {
      driver.when.orderUpdated(faker.string.uuid());

      expect(driver.get.deferredFailure()).toMatchObject({
        code: 'ATLAS_EVENT_LISTENER_FAILED',
        cause: failure,
      } satisfies Partial<AtlasError>);
    });
  });
});
