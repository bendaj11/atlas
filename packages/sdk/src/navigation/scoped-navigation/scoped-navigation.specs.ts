import { faker } from '@faker-js/faker';
import { ScopedNavigationDriver } from './scoped-navigation.driver.js';

describe('createScopedNavigation', () => {
  let driver: ScopedNavigationDriver;

  beforeEach(() => {
    driver = new ScopedNavigationDriver();
  });

  describe('when the app path is /catalog', () => {
    beforeEach(() => {
      driver.given.path('/catalog').when.created();
    });

    it('should navigate the host to the scoped path when the app navigates to a relative target', () => {
      driver.when.navigated('details/42');

      expect(driver.get.hostNavigation().navigate).toHaveBeenCalledWith(
        '/catalog/details/42',
        undefined,
      );
    });

    it('should replace the host location with the scoped path when the app replaces a relative target', () => {
      driver.when.replaced('/details/42');

      expect(driver.get.hostNavigation().replace).toHaveBeenCalledWith(
        '/catalog/details/42',
        undefined,
      );
    });

    it('should expose the normalized app path when created', () => {
      expect(driver.get.scoped().path).toBe('/catalog');
    });

    it('should return the scoped host path when toHostPath is called', () => {
      expect(driver.get.scoped().toHostPath('/settings')).toBe(
        '/catalog/settings',
      );
    });

    it('should return the scoped href when createHref is called', () => {
      expect(driver.get.scoped().createHref('settings')).toBe(
        '/catalog/settings',
      );
    });

    it('should call host go with the delta when the app moves through history', () => {
      const delta = faker.number.int({ min: -5, max: 5 });

      driver.when.historyMoved(delta);

      expect(driver.get.hostNavigation().go).toHaveBeenCalledWith(delta);
    });

    it('should return the host location when the current location is read', () => {
      expect(driver.get.scoped().getCurrentLocation()).toEqual(
        driver.get.hostNavigation().getCurrentLocation(),
      );
    });

    it('should call the listener with the host location when the app subscribes', () => {
      driver.when.subscribed();

      expect(driver.get.listenerMock()).toHaveBeenCalledWith(
        driver.get.hostNavigation().getCurrentLocation(),
      );
    });

    it('should call host back when the app goes back', () => {
      driver.when.wentBack();

      expect(driver.get.hostNavigation().back).toHaveBeenCalledTimes(1);
    });
  });
});
