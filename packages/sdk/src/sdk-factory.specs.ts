import { expect, it } from '@jest/globals';
import { createMemoryNavigation } from '../../testkit/dist/index.js';
import { createAtlasSdk } from './sdk-factory.js';

it('should preserve a host-owned client when the host contract defines one', () => {
  const orders = { create: async (): Promise<void> => undefined };
  const sdk = createAtlasSdk<{ orders: typeof orders }>({
    hostId: 'host',
    navigation: createMemoryNavigation(),
    orders,
  });

  expect(sdk.orders).toBe(orders);
});
