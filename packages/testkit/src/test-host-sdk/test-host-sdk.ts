import { faker } from '@faker-js/faker';
import { createAtlasSdk, type AtlasSdk } from '@atlas/sdk/host';
import { createMemoryNavigation } from '../memory-navigation/memory-navigation.js';

export function createTestHostSdk(hostId = faker.string.uuid()): AtlasSdk {
  return createAtlasSdk({
    hostId,
    navigation: createMemoryNavigation(),
  });
}
