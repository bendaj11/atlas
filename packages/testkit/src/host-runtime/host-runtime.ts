import { faker } from '@faker-js/faker';
import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import { aHostManifest } from '../manifests/artifact-manifests/artifact-manifests.js';
import {
  aRegistryUrl,
  aSha256Digest,
} from '../publication/identifiers/identifiers.js';

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
    revision: aSha256Digest(),
    generatedAt: faker.date.recent().toISOString(),
    host: aHostManifest({ id: hostId }),
    apps: [],
    ...overrides,
  };
}
