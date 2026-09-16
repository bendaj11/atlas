import { faker } from '@faker-js/faker';
import { aHostCatalog, aHostRuntimeConfig } from '@atlas/testkit';
import type { HostData } from './host-data';

export function aHostData(overrides: Partial<HostData> = {}): HostData {
  const hostId = faker.string.uuid();

  return {
    config: aHostRuntimeConfig({ hostId }),
    pageUrl: faker.internet.url(),
    catalog: aHostCatalog({ hostId }),
    overrides: undefined,
    overrideScope: undefined,
    versions: {},
    runtimeErrors: [],
    versionErrors: [],
    ...overrides,
  };
}
