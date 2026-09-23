import { faker } from '@faker-js/faker';
import type { AtlasManifest } from '@atlas/schema';
import type {
  AtlasRuntimeOverride,
  AtlasRuntimeOverrideDocument,
  AtlasRuntimeOverrideReason,
} from './overrides.types.js';

export const ALL_OVERRIDE_REASONS: readonly AtlasRuntimeOverrideReason[] = [
  'local',
  'pr',
  'historical',
];

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

export function anOverrideOf(
  manifest: AtlasManifest,
  reason: AtlasRuntimeOverrideReason = faker.helpers.arrayElement(
    ALL_OVERRIDE_REASONS,
  ),
): AtlasRuntimeOverride {
  return { appId: manifest.id, manifest, reason };
}
