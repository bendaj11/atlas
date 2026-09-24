/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { aHostCatalog, aHostRuntimeConfig } from '@atlas/testkit';
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

describe('defineReactHost', () => {
  let driver: ReactAdapterDriver;

  beforeEach(() => {
    driver = new ReactAdapterDriver();
  });

  describe('when a named host is mounted through the react dom client', () => {
    const name = faker.company.name();
    const region = faker.location.countryCode();
    const runtimeConfig = aHostRuntimeConfig();

    beforeEach(async () => {
      await driver.given
        .hostName(name)
        .given.region(region)
        .given.runtimeConfig(runtimeConfig)
        .given.legacyReactDom(false)
        .when.reactHostMounted();
    });

    it('should render the layout through the atlas router when mounted', () => {
      expect(driver.get.definedLayoutPresent()).toBe(true);
    });

    it('should start the dom host with an sdk owned by the config host id when mounted', () => {
      expect(driver.get.startedOptions().sdk?.hostId).toBe(driver.hostId);
    });

    it('should merge the atlas host identity into the custom host data when mounted', () => {
      expect(driver.get.startedOptions().hostData).toEqual({
        region,
        hostId: driver.hostId,
        name,
      });
    });

    it('should forward the request runtime config when mounted', () => {
      expect(driver.get.startedOptions().runtimeConfig).toBe(runtimeConfig);
    });

    it('should forward renderHostLoading from the custom sdk options when mounted', () => {
      expect(driver.get.startedOptions().renderHostLoading).toBe(
        driver.get.renderHostLoadingMock(),
      );
    });

    it('should omit the catalog when the request has no catalog', () => {
      expect('catalog' in driver.get.startedOptions()).toBe(false);
    });

    it('should stop the runtime when unmounted', async () => {
      await driver.when.reactHostUnmounted();

      expect(driver.get.stopMock()).toHaveBeenCalledTimes(1);
    });
  });

  it('should use the host id as host data name when the config has no name', async () => {
    await driver.given
      .hostName(undefined)
      .given.legacyReactDom(false)
      .when.reactHostMounted();

    expect(driver.get.startedOptions().hostData?.name).toBe(driver.hostId);
  });

  it('should render the layout inside the host providers when providers are given', async () => {
    await driver.given
      .hostProviders(true)
      .given.legacyReactDom(false)
      .when.reactHostMounted();

    expect(driver.get.layoutInsideProviders()).toBe(true);
  });

  it('should render the layout without host providers when no providers are given', async () => {
    await driver.given
      .hostProviders(false)
      .given.legacyReactDom(false)
      .when.reactHostMounted();

    expect(driver.get.definedLayoutPresent()).toBe(true);
  });

  it('should forward the request catalog when the request has a catalog', async () => {
    const catalog = aHostCatalog();

    await driver.given
      .catalog(catalog)
      .given.legacyReactDom(false)
      .when.reactHostMounted();

    expect(driver.get.startedOptions().catalog).toBe(catalog);
  });

  describe('when mounted through legacy react dom', () => {
    beforeEach(async () => {
      await driver.given.legacyReactDom(true).when.reactHostMounted();
    });

    it('should call legacy render with the request container when mounted', () => {
      expect(driver.get.legacyRenderMock()).toHaveBeenCalledWith(
        expect.anything(),
        driver.get.container(),
      );
    });

    it('should call unmountComponentAtNode with the request container when unmounted', async () => {
      await driver.when.reactHostUnmounted();

      expect(driver.get.unmountComponentAtNodeMock()).toHaveBeenCalledWith(
        driver.get.container(),
      );
    });
  });
});
