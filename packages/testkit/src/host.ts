import { faker } from '@faker-js/faker';
import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import { aHostManifest } from './manifests.js';
import { aRegistryUrl } from './publication.js';

export function aHostRuntimeConfig(
  overrides: Partial<AtlasHostRuntimeConfig> = {},
): AtlasHostRuntimeConfig {
  return {
    schemaVersion: 'v1',
    hostId: faker.string.uuid(),
    environment: faker.word.noun(),
    artifactRegistryUrl: aRegistryUrl(),
    ...overrides,
  };
}

export function aHostCatalog(
  overrides: Partial<AtlasHostCatalog> = {},
): AtlasHostCatalog {
  const hostId = overrides.hostId ?? overrides.host?.id ?? faker.string.uuid();

  return {
    schemaVersion: '1',
    hostId,
    revision: faker.string.uuid(),
    generatedAt: faker.date.recent().toISOString(),
    host: aHostManifest({ id: hostId }),
    apps: [],
    ...overrides,
  };
}
