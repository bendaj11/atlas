import { faker } from '@faker-js/faker';
import { ReactHostNavigationDriver } from './react-host-navigation.driver.js';

describe('createHostNavigation', () => {
  let driver: ReactHostNavigationDriver;

  beforeEach(() => {
    driver = new ReactHostNavigationDriver();
  });

  describe('when the router is at /orders?tab=open', () => {
    beforeEach(() => {
      driver.given.routerUrl('/orders?tab=open').when.created();
    });

    it('should read the router location when getCurrentLocation is called', () => {
      expect(driver.get.navigation().getCurrentLocation()).toEqual({
        pathname: '/orders',
        search: '?tab=open',
        hash: '',
      });
    });

    it('should call router navigate without options when navigating', () => {
      driver.when.navigated('/orders/42');

      expect(driver.get.navigateMock()).toHaveBeenCalledWith('/orders/42', {});
    });

    it('should forward the state when navigating with state', () => {
      const state = { from: faker.word.noun() };

      driver.when.navigatedWithState('/orders/42', state);

      expect(driver.get.navigateMock()).toHaveBeenCalledWith('/orders/42', {
        state,
      });
    });

    it('should forward replace false when navigating without replacing', () => {
      driver.when.navigatedWithReplace('/orders/42', false);

      expect(driver.get.navigateMock()).toHaveBeenCalledWith('/orders/42', {
        replace: false,
      });
    });

    it('should call router navigate with replace when replacing', () => {
      driver.when.replaced('/orders/43');

      expect(driver.get.navigateMock()).toHaveBeenCalledWith('/orders/43', {
        replace: true,
      });
    });

    it('should keep the state when replacing with state', () => {
      const state = { from: faker.word.noun() };

      driver.when.replacedWithState('/orders/43', state);

      expect(driver.get.navigateMock()).toHaveBeenCalledWith('/orders/43', {
        replace: true,
        state,
      });
    });

    it('should call router navigate with -1 when going back', () => {
      driver.when.wentBack();

      expect(driver.get.navigateMock()).toHaveBeenCalledWith(-1);
    });

    it('should call router navigate with the delta when going through history', () => {
      driver.when.wentThroughHistory(-3);

      expect(driver.get.navigateMock()).toHaveBeenCalledWith(-3);
    });

    it('should resolve the href against the origin when createHref is called', () => {
      expect(driver.get.navigation().createHref('/orders')).toBe(
        `${driver.get.origin()}/orders`,
      );
    });

    describe('when subscribed', () => {
      beforeEach(() => {
        driver.when.subscribed();
      });

      it('should call the listener with the current location when subscribing', () => {
        expect(driver.get.listenerMock()).toHaveBeenCalledWith({
          pathname: '/orders',
          search: '?tab=open',
          hash: '',
        });
      });

      it('should call the listener with the new location when the router navigates', () => {
        driver.when.navigated('/orders/42');

        expect(driver.get.listenerMock()).toHaveBeenLastCalledWith({
          pathname: '/orders/42',
          search: '',
          hash: '',
        });
      });

      it('should drop the router subscriber when unsubscribing', () => {
        driver.when.unsubscribed();

        expect(driver.get.subscriberCount()).toBe(0);
      });
    });
  });

  describe('when the router location carries no search and no hash', () => {
    beforeEach(() => {
      driver.given.routerPathnameOnly('/orders').when.created();
    });

    it('should report empty search and hash when getCurrentLocation is called', () => {
      expect(driver.get.navigation().getCurrentLocation()).toEqual({
        pathname: '/orders',
        search: '',
        hash: '',
      });
    });
  });

  describe('when created without an origin', () => {
    beforeEach(() => {
      driver.given.routerUrl('/orders').when.createdWithDefaultOrigin();
    });

    it('should resolve the href against the default host origin when createHref is called', () => {
      expect(driver.get.navigation().createHref('/orders')).toBe(
        'http://localhost/orders',
      );
    });
  });
});
