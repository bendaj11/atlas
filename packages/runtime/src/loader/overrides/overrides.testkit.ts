import { faker } from '@faker-js/faker';
import type {
  AtlasManifest,
  AtlasRuntimeOverride,
  AtlasRuntimeOverrideReason,
} from '@atlas/schema';

export const ALL_OVERRIDE_REASONS: readonly AtlasRuntimeOverrideReason[] = [
  'local',
  'pr',
  'historical',
];

export function anOverrideOf(
  manifest: AtlasManifest,
  reason: AtlasRuntimeOverrideReason = faker.helpers.arrayElement(
    ALL_OVERRIDE_REASONS,
  ),
): AtlasRuntimeOverride {
  return { appId: manifest.id, manifest, reason };
}
