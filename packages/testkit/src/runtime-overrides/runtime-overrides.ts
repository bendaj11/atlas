import { faker } from '@faker-js/faker';
import type { AtlasRuntimeOverrideDocument } from '@atlas/schema';

export function anOverrideDocument(
  overrides: Partial<AtlasRuntimeOverrideDocument> = {},
): AtlasRuntimeOverrideDocument {
  return {
    schemaVersion: '1',
    hostId: faker.string.uuid(),
    generatedAt: faker.date.recent().toISOString(),
    overrides: [],
    ...overrides,
  };
}
