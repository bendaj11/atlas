import type { AtlasNavigation } from './navigation-types.js';
import { createAtlasSdk } from './sdk-factory.js';

type Orders = { create: () => Promise<void> };

export class SdkFactoryDriver {
  private orders?: Orders;
  private sdk?: ReturnType<typeof createAtlasSdk<{ orders: Orders }>>;

  readonly given = {
    orders: (orders: Orders): SdkFactoryDriver => {
      this.orders = orders;
      return this;
    },
  };

  readonly when = {
    createSdk: (): void => {
      if (!this.orders) {
        throw new Error('Host orders must be set before creating the SDK.');
      }

      this.sdk = createAtlasSdk({
        hostId: 'host',
        navigation: createMemoryNavigation(),
        orders: this.orders,
      });
    },
  };

  readonly get = {
    orders: (): Orders => {
      if (!this.sdk) {
        throw new Error('SDK must be created before reading orders.');
      }

      return this.sdk.orders;
    },
  };
}

function createMemoryNavigation(): AtlasNavigation {
  return {
    navigate: () => undefined,
    replace: () => undefined,
    back: () => undefined,
    createHref: (to) => to,
    subscribe: () => () => undefined,
    getCurrentLocation: () => ({ pathname: '/', search: '', hash: '' }),
  };
}
