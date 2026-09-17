import { faker } from '@faker-js/faker';
import type { AtlasHostRuntimeConfig } from './atlas-host-runtime-config.js';

export function aRegistryRootUrl(): string {
  return `https://${faker.internet.domainName()}/${faker.lorem.slug()}`;
}

export function aHostRuntimeConfig(
  overrides: Partial<AtlasHostRuntimeConfig> = {},
): AtlasHostRuntimeConfig {
  return {
    schemaVersion: 'v1',
    hostId: faker.string.uuid(),
    environment: faker.word.noun(),
    artifactRegistryUrl: aRegistryRootUrl(),
    ...overrides,
  };
}
