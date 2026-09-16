import { faker } from '@faker-js/faker';
import { AngularHostNavigationDriver } from './angular-host-navigation.driver.js';

describe('createHostNavigation', () => {
  let driver: AngularHostNavigationDriver;

  beforeEach(() => {
    driver = new AngularHostNavigationDriver();
  });

  describe('when the router is at /orders?tab=open', () => {
    beforeEach(() => {
      driver.given.routerUrl('/orders?tab=open').when.created();
    });

    it('should split the router url when getCurrentLocation is called', () => {
      expect(driver.get.navigation().getCurrentLocation()).toEqual({
        pathname: '/orders',
        search: '?tab=open',
        hash: '',
      });
    });

    it('should call navigateByUrl without options when navigating', () => {
      driver.when.navigated('/orders/42');

      expect(driver.get.navigateByUrlMock()).toHaveBeenCalledWith(
        '/orders/42',
        {},
      );
    });

    it('should call navigateByUrl with replaceUrl when replacing', () => {
      driver.when.replaced('/orders/43');

      expect(driver.get.navigateByUrlMock()).toHaveBeenCalledWith(
        '/orders/43',
        {
          replaceUrl: true,
        },
      );
    });

    it('should call location back when going back', () => {
      driver.when.wentBack();

      expect(driver.get.backMock()).toHaveBeenCalledTimes(1);
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

      it('should ignore router events when the url did not change', () => {
        driver.when.routerEventEmitted();
        driver.when.routerEventEmitted();

        expect(driver.get.listenerMock()).toHaveBeenCalledTimes(1);
      });

      it('should call the listener once when the router emits twice for one url change', () => {
        driver.when.routerUrlChanged('/orders/details/42');
        driver.when.routerEventEmitted();
        driver.when.routerEventEmitted();

        expect(driver.get.listenerMock()).toHaveBeenCalledTimes(2);
      });
    });
  });

  it('should call historyGo with the delta when the location supports it', () => {
    const delta = faker.number.int({ min: -5, max: 5 });
    driver.given.historyGoSupported(true).when.created();

    driver.when.historyMoved(delta);

    expect(driver.get.historyGoMock()).toHaveBeenCalledWith(delta);
  });

  it('should fall back to back when the location lacks historyGo and the delta is -1', () => {
    driver.given.historyGoSupported(false).when.created();

    driver.when.historyMoved(-1);

    expect(driver.get.backMock()).toHaveBeenCalledTimes(1);
  });
});
