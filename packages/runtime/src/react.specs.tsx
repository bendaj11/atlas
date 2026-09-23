/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { ReactAdapterDriver } from './react.driver.js';

describe('AtlasHostProvider', () => {
  let driver: ReactAdapterDriver;

  beforeEach(() => {
    driver = new ReactAdapterDriver();
  });

  describe('when the host is rendered', () => {
    const region = faker.location.countryCode();

    beforeEach(async () => {
      await driver.given.region(region).when.hostRendered();
    });

    it('should provide the sdk host data to children when rendered', () => {
      expect(driver.get.regionText()).toBe(region);
    });

    it('should start the dom host once when rendered', () => {
      expect(driver.get.startDomHostMock()).toHaveBeenCalledTimes(1);
    });

    it('should start the dom host with the provider-owned sdk when rendered', () => {
      expect(driver.get.startedOptions().sdk?.hostId).toBe(driver.hostId);
    });

    it('should create the host navigation from the router when rendered', async () => {
      expect(await driver.get.startedNavigationPathname()).toBe(
        driver.get.routerPathname(),
      );
    });

    it('should register the status anchor when rendered', () => {
      expect(driver.get.anchorTag('status')).toBe('ATLAS-STATUS');
    });

    it('should hide layout content when the layout is not active', () => {
      expect(driver.get.layoutContentPresent()).toBe(false);
    });

    it('should stop the runtime when unmounted', async () => {
      await driver.when.unmounted();

      expect(driver.get.stopMock()).toHaveBeenCalledTimes(1);
    });

    it('should update the sdk host data when the hostData option changes', async () => {
      const nextRegion = faker.location.countryCode();

      await driver.when.regionChanged(nextRegion);

      expect(driver.get.regionText()).toBe(nextRegion);
    });

    it('should expose published navigation items when items are published', async () => {
      const labels = [faker.word.noun(), faker.word.noun()];

      await driver.when.navigationItemsPublished(labels);

      expect(driver.get.itemsText()).toBe(labels.join(','));
    });

    describe('when the layout is activated', () => {
      beforeEach(async () => {
        await driver.when.layoutActivated();
      });

      it('should show layout content when activated', () => {
        expect(driver.get.layoutContentPresent()).toBe(true);
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
    });
  });

  describe('when the default host layout is rendered and activated', () => {
    beforeEach(async () => {
      await driver.given.defaultLayout().when.hostRendered();

      await driver.when.layoutActivated();
    });

    it('should render the Atlas header when the default layout is active', () => {
      expect(driver.get.headerText()).toBe('Atlas');
    });

    it('should register the header slot anchor when the default layout is active', () => {
      expect(driver.get.slotTag()).toBe('ATLAS-SLOT');
    });
  });

  it('should throw ATLAS_HOST_PROVIDER_MISSING when an anchor renders outside the provider', () => {
    driver.when.slotRenderedOutsideProvider();

    expect(driver.get.renderError()).toMatchObject({
      code: 'ATLAS_HOST_PROVIDER_MISSING',
    });
  });
});
