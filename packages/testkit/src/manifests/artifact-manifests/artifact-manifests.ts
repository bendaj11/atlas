import { faker } from '@faker-js/faker';
import {
  ATLAS_DOM_ISOLATIONS,
  ATLAS_FRAMEWORKS,
  ATLAS_VERSION_CHANNELS,
  type AtlasArtifactManifestBase,
  type AtlasHostManifest,
  type AtlasManifest,
  type AtlasVersionChannel,
} from '@atlas/schema';

export const PUBLISHED_CHANNELS: readonly AtlasVersionChannel[] = [
  'production',
  'pr',
];

function anArtifactManifestBase(): Omit<AtlasArtifactManifestBase, 'kind'> {
  return {
    schemaVersion: '1',
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    version: faker.system.semver(),
    buildId: faker.string.alphanumeric(8),
    channel: faker.helpers.arrayElement(ATLAS_VERSION_CHANNELS),
    framework: faker.helpers.arrayElement(ATLAS_FRAMEWORKS),
    remoteEntryUrl: faker.internet.url(),
    createdAt: faker.date.recent().toISOString(),
  };
}

export function anAppManifest(
  overrides: Partial<AtlasManifest> = {},
): AtlasManifest {
  const placements = overrides.placements ?? [];
  const supportedHosts = placements.length
    ? [...new Set(placements.map((placement) => placement.hostId))]
    : [faker.string.uuid()];

  return {
    ...anArtifactManifestBase(),
    kind: 'app',
    isolation: faker.helpers.arrayElement(ATLAS_DOM_ISOLATIONS),
    exposes: { entry: `./${faker.word.noun()}` },
    requiredHostSdkVersion: `^${faker.system.semver()}`,
    supportedHosts,
    placements,
    ...overrides,
  };
}

export function aHostManifest(
  overrides: Partial<AtlasHostManifest> = {},
): AtlasHostManifest {
  return {
    ...anArtifactManifestBase(),
    kind: 'host',
    exposes: { entry: `./${faker.word.noun()}` },
    requiredLoaderApiVersion: `^${faker.system.semver()}`,
    ...overrides,
  };
}

export function anAppVersionOf(
  manifest: AtlasManifest,
  overrides: Partial<AtlasManifest> = {},
): AtlasManifest {
  const { id, name, supportedHosts } = manifest;

  return anAppManifest({ id, name, supportedHosts, ...overrides });
}
