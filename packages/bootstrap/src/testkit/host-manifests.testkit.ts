import type { AtlasHostManifest, AtlasHostRuntimeConfig } from '@atlas/schema';
import { faker } from '@faker-js/faker';
import { aHostManifest } from '@atlas/testkit';
import { PUBLISHED_CHANNELS } from '@atlas/testkit/internal';

export function aPublishedHostManifestFor(
  runtime: Pick<AtlasHostRuntimeConfig, 'hostId' | 'artifactRegistryUrl'>,
  overrides: Partial<AtlasHostManifest> = {},
): AtlasHostManifest {
  return aHostManifest({
    id: runtime.hostId,
    channel: faker.helpers.arrayElement(PUBLISHED_CHANNELS),
    remoteEntryUrl: `${runtime.artifactRegistryUrl}/${faker.system.fileName()}`,
    requiredLoaderApiVersion: '^1.0.0',
    ...overrides,
  });
}
