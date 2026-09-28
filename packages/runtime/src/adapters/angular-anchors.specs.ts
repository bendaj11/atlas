/** @jest-environment jsdom */

import { AngularAnchorsDriver } from './angular-anchors.driver.js';

describe('AtlasAngularHostAnchors', () => {
  let driver: AngularAnchorsDriver;

  beforeEach(() => {
    driver = new AngularAnchorsDriver();
  });

  describe('when the host root is bootstrapped', () => {
    beforeEach(async () => {
      await driver.when.bootstrapped();
    });

    it('should register the status anchor when bootstrapped', () => {
      expect(driver.get.anchorTag('status')).toBe('ATLAS-HOST-STATUS');
    });

    it('should render no layout children when the layout is inactive', () => {
      expect(driver.get.layoutChildTags()).toEqual([]);
    });

    it('should forget the status anchor when destroyed', () => {
      driver.when.destroyed();

      expect(driver.get.anchorTag('status')).toBeUndefined();
    });

    describe('when the layout is activated', () => {
      beforeEach(() => {
        driver.when.layoutActivated();
      });

      it('should render the layout children when activated', () => {
        expect(driver.get.layoutChildTags()).toEqual([
          'ATLAS-NAVIGATION',
          'ATLAS-SLOT',
          'ATLAS-ROUTE-OUTLET',
        ]);
      });

      it.each(['navigation'] as const)(
        'should register the %s anchor when activated',
        (kind) => {
          expect(driver.get.anchorTag(kind)).toBe(
            `ATLAS-${kind.toUpperCase()}`,
          );
        },
      );

      it('should register the mount element inside atlas-route-outlet as the route-outlet anchor when activated', () => {
        expect(driver.get.routeOutletParentTag()).toBe('ATLAS-ROUTE-OUTLET');
      });

      it('should register the slot anchor by slot id when activated', () => {
        expect(driver.get.slotTag()).toBe('ATLAS-SLOT');
      });

      it('should remove the layout children when deactivated', () => {
        driver.when.layoutDeactivated();

        expect(driver.get.layoutChildTags()).toEqual([]);
      });

      it('should forget the slot anchor when deactivated', () => {
        driver.when.layoutDeactivated();

        expect(driver.get.slotTag()).toBeUndefined();
      });
    });
  });

  describe('when a host with a not-found component activates its layout', () => {
    beforeEach(async () => {
      await driver.given.notFoundComponent(true).when.bootstrapped();

      driver.when.layoutActivated();
    });

    it('should render the host not-found component when the route is not found', () => {
      driver.when.routeNotFoundSet(true);

      expect(driver.get.hostNotFoundPresent()).toBe(true);
    });

    it('should remove the host not-found component when the route is found again', () => {
      driver.when.routeNotFoundSet(true);
      driver.when.routeNotFoundSet(false);

      expect(driver.get.hostNotFoundPresent()).toBe(false);
    });
  });

  describe('when a host without a not-found component activates its layout', () => {
    beforeEach(async () => {
      await driver.given.notFoundComponent(false).when.bootstrapped();

      driver.when.layoutActivated();
    });

    it('should render the default not-found page when the route is not found', () => {
      driver.when.routeNotFoundSet(true);

      expect(driver.get.defaultNotFoundPresent()).toBe(true);
    });
  });
});
