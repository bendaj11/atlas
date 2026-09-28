import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { createMemoryNavigation } from '../../memory-navigation/memory-navigation.js';
import { createMockSdk } from './mock-sdk.js';

interface CustomerUser {
  name: string;
}

type CreateOrder = () => Promise<string>;

interface CustomerHostSdk {
  hostData: { user: CustomerUser | null };
  orders: { create: CreateOrder };
  showToast(message: string): void;
}

type OrderEvents = {
  'orders.created': { orderId: string };
};

describe('createMockSdk', () => {
  it('should expose the mocked host extension when the extension is mocked', () => {
    const orders = { create: jest.fn<CreateOrder>() };

    expect(
      createMockSdk<CustomerHostSdk, OrderEvents>({
        navigation: createMemoryNavigation(),
        overrides: { orders },
      }).orders,
    ).toBe(orders);
  });

  it('should throw a not mocked error when an unmocked host method is called', () => {
    const sdk = createMockSdk<CustomerHostSdk, OrderEvents>({
      navigation: createMemoryNavigation(),
      overrides: {},
    });

    expect(() => sdk.showToast(faker.lorem.sentence())).toThrow(
      'Atlas SDK "showToast" is not mocked. Pass it to mockAtlasEnvironment({ sdk: { showToast } }).',
    );
  });

  it('should throw a not mocked error when a member of an unmocked host extension is read', () => {
    const sdk = createMockSdk<CustomerHostSdk, OrderEvents>({
      navigation: createMemoryNavigation(),
      overrides: {},
    });

    expect(() => sdk.orders.create).toThrow(
      'Atlas SDK "orders" is not mocked. Pass it to mockAtlasEnvironment({ sdk: { orders } }).',
    );
  });

  it('should resolve to itself when awaited', async () => {
    const sdk = createMockSdk<CustomerHostSdk, OrderEvents>({
      navigation: createMemoryNavigation(),
      overrides: {},
    });

    await expect(Promise.resolve(sdk)).resolves.toBe(sdk);
  });

  it('should use the mocked host id when the host id is mocked', () => {
    const hostId = faker.string.uuid();

    expect(
      createMockSdk<CustomerHostSdk, OrderEvents>({
        navigation: createMemoryNavigation(),
        overrides: { hostId },
      }).hostId,
    ).toBe(hostId);
  });

  it('should expose the mocked host data when host data is mocked', () => {
    const user = { name: faker.person.firstName() };

    expect(
      createMockSdk<CustomerHostSdk, OrderEvents>({
        navigation: createMemoryNavigation(),
        overrides: { hostData: { user } },
      }).hostData.user,
    ).toBe(user);
  });

  it('should call the mocked navigateTo with app id and state when the app navigates', () => {
    const navigateTo = jest.fn();
    const appId = faker.string.uuid();
    const state = { tab: faker.lorem.word() };
    const sdk = createMockSdk<CustomerHostSdk, OrderEvents>({
      navigation: createMemoryNavigation(),
      overrides: { navigateTo },
    });

    sdk.navigateTo(appId, state);

    expect(navigateTo).toHaveBeenCalledWith(appId, state);
  });

  it('should ignore navigation when navigateTo is not mocked', () => {
    const sdk = createMockSdk<CustomerHostSdk, OrderEvents>({
      navigation: createMemoryNavigation(),
      overrides: {},
    });

    expect(() => sdk.navigateTo(faker.string.uuid())).not.toThrow();
  });

  it('should call the mocked getWidget with the widget id when a widget is requested', () => {
    const widgetId = faker.string.uuid();
    const getWidget = jest.fn(() => ({
      id: widgetId,
      name: faker.commerce.productName(),
      mount: async () => ({ unmount: async () => undefined }),
    }));
    const sdk = createMockSdk<CustomerHostSdk, OrderEvents>({
      navigation: createMemoryNavigation(),
      overrides: { getWidget },
    });

    sdk.getWidget(widgetId);

    expect(getWidget).toHaveBeenCalledWith(widgetId);
  });

  it('should return a widget handle for the requested id when getWidget is not mocked', () => {
    const widgetId = faker.string.uuid();

    expect(
      createMockSdk<CustomerHostSdk, OrderEvents>({
        navigation: createMemoryNavigation(),
        overrides: {},
      }).getWidget(widgetId).id,
    ).toBe(widgetId);
  });

  it('should deliver the payload to event listeners when an event is emitted', () => {
    const listener = jest.fn();
    const orderId = faker.string.uuid();
    const sdk = createMockSdk<CustomerHostSdk, OrderEvents>({
      navigation: createMemoryNavigation(),
      overrides: {},
    });
    sdk.events.addEventListener('orders.created', listener);

    sdk.events.emit('orders.created', { orderId });

    expect(listener).toHaveBeenCalledWith({ orderId });
  });
});
