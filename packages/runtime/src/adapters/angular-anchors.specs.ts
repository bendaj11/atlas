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

      it.each(['navigation', 'route-outlet'] as const)(
        'should register the %s anchor when activated',
        (kind) => {
          expect(driver.get.anchorTag(kind)).toBe(
            `ATLAS-${kind.toUpperCase()}`,
          );
        },
      );

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
});
