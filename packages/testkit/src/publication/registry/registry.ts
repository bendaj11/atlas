import { faker } from '@faker-js/faker';
import type { AtlasRegistryArtifact, AtlasStaticRegistry } from '@atlas/schema';
import { aSha256Digest } from '../identifiers/identifiers.js';

export function aRegistryArtifact(
  overrides: Partial<AtlasRegistryArtifact> = {},
): AtlasRegistryArtifact {
  return {
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    packageName: faker.word.noun().toLowerCase(),
    releases: {},
    previews: {},
    ...overrides,
  };
}

export function aStaticRegistry(
  overrides: Partial<AtlasStaticRegistry> = {},
): AtlasStaticRegistry {
  return {
    schemaVersion: '2',
    revision: aSha256Digest(),
    updatedAt: faker.date.recent().toISOString(),
    hosts: {},
    apps: {},
    ...overrides,
  };
}
