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

    it('should call router navigate with replace when replacing', () => {
      driver.when.replaced('/orders/43');

      expect(driver.get.navigateMock()).toHaveBeenCalledWith('/orders/43', {
        replace: true,
      });
    });

    it('should call router navigate with -1 when going back', () => {
      driver.when.wentBack();

      expect(driver.get.navigateMock()).toHaveBeenCalledWith(-1);
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
    });
  });
});
