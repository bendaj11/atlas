import { faker } from '@faker-js/faker';
import { createAtlasEventBus } from '../event-bus/event-bus.js';
import { SdkFactoryDriver } from './sdk-factory.driver.js';

describe('createAtlasSdk', () => {
  let driver: SdkFactoryDriver;

  beforeEach(() => {
    driver = new SdkFactoryDriver();
  });

  it('should expose the host id when created', () => {
    const hostId = faker.string.uuid();
    driver.given.hostId(hostId).when.sdkCreated();

    expect(driver.get.sdk().hostId).toBe(hostId);
  });

  it('should expose custom host data merged with host id and name when created with a named host', () => {
    const hostId = faker.string.uuid();
    const name = faker.company.name();
    const storeId = faker.string.uuid();
    driver.given
      .hostId(hostId)
      .given.hostData({ storeId, name })
      .when.sdkCreated();

    expect(driver.get.sdk().hostData).toEqual({ hostId, name, storeId });
  });

  it('should use the host id as host data name when created without a name', () => {
    const hostId = faker.string.uuid();
    driver.given
      .hostId(hostId)
      .given.hostData({ storeId: faker.string.uuid() })
      .when.sdkCreated();

    expect(driver.get.sdk().hostData.name).toBe(hostId);
  });

  it('should preserve a host-owned property when the host contract defines one', () => {
    const showToast = (_message: string): void => undefined;
    driver.given.showToast(showToast).when.sdkCreated();

    expect(driver.get.sdk().showToast).toBe(showToast);
  });

  it('should use the given event bus when created with one', () => {
    const eventBus = createAtlasEventBus();
    driver.given.eventBus(eventBus).when.sdkCreated();

    expect(driver.get.sdk().events).toBe(eventBus);
  });

  it('should throw ATLAS_SDK_PROPERTY_CONFLICT when a host property is named like a core capability', () => {
    driver.given.reservedProperty('events', faker.lorem.word());

    expect(() => driver.when.sdkCreated()).toThrow(
      expect.objectContaining({ code: 'ATLAS_SDK_PROPERTY_CONFLICT' }),
    );
  });

  describe('when created', () => {
    beforeEach(() => {
      driver.when.sdkCreated();
    });

    it('should return the host navigation when getAtlasNavigation is called with the sdk', () => {
      expect(driver.get.atlasNavigationOf(driver.get.sdk())).toBe(
        driver.get.hostNavigation(),
      );
    });

    it('should throw ATLAS_HOST_NAVIGATION_NOT_READY when getAtlasNavigation is called with an unknown object', () => {
      expect(() => driver.get.atlasNavigationOf({})).toThrow(
        expect.objectContaining({ code: 'ATLAS_HOST_NAVIGATION_NOT_READY' }),
      );
    });

    it('should throw ATLAS_WIDGET_RUNTIME_NOT_READY when getWidget is called before the widget resolver is connected', () => {
      expect(() => driver.get.widget(faker.string.uuid())).toThrow(
        expect.objectContaining({ code: 'ATLAS_WIDGET_RUNTIME_NOT_READY' }),
      );
    });

    it('should throw ATLAS_ROUTE_RUNTIME_NOT_READY when navigateTo is called before the navigation resolver is connected', () => {
      expect(() => driver.when.navigatedTo(faker.string.uuid())).toThrow(
        expect.objectContaining({ code: 'ATLAS_ROUTE_RUNTIME_NOT_READY' }),
      );
    });

    it('should call the navigation resolver with app id and state when navigateTo is called after it is connected', () => {
      const appId = faker.string.uuid();
      const state = { orderId: faker.string.uuid() };

      driver.when.navigationResolverConnected();
      driver.when.navigatedTo(appId, state);

      expect(driver.get.navigationResolverMock()).toHaveBeenCalledWith(
        appId,
        state,
      );
    });

    describe('when the widget resolver is connected', () => {
      const handle = {
        id: faker.string.uuid(),
        name: faker.commerce.productName(),
        mount: async () => ({ unmount: async () => undefined }),
      };

      beforeEach(() => {
        driver.given.widgetHandle(handle);

        driver.when.widgetResolverConnected();
      });

      it('should return the resolved handle when getWidget is called', () => {
        expect(driver.get.widget(faker.string.uuid())).toBe(handle);
      });

      it('should forward widget id and options to the resolver when getWidget is called with loading options', () => {
        const widgetId = faker.string.uuid();
        const options = { renderLoading: () => undefined };

        driver.get.widget(widgetId, options);

        expect(driver.get.widgetResolverMock()).toHaveBeenCalledWith(
          widgetId,
          options,
        );
      });
    });
  });
});
