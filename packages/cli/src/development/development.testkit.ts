import { faker } from '@faker-js/faker';
import type { AtlasDevOverrideDocument } from './types.js';

export function anOverrideDocument(
  overrides: Partial<AtlasDevOverrideDocument> = {},
): AtlasDevOverrideDocument {
  return {
    schemaVersion: '1',
    hostId: faker.string.uuid(),
    overrides: [],
    generatedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}
