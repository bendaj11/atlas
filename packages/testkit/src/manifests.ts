import { faker } from '@faker-js/faker';
import type {
  AtlasArtifactManifestBase,
  AtlasHostManifest,
  AtlasManifest,
} from '@atlas/schema';

type ArtifactManifest = AtlasManifest | AtlasHostManifest;

export const ALL_CHANNELS: readonly ArtifactManifest['channel'][] = [
  'production',
  'pr',
  'local',
];
export const PUBLISHED_CHANNELS: readonly ArtifactManifest['channel'][] = [
  'production',
  'pr',
];
export const ALL_FRAMEWORKS: readonly ArtifactManifest['framework'][] = [
  'angular',
  'react',
  'vue',
];

function anArtifactManifestBase(): Omit<AtlasArtifactManifestBase, 'kind'> {
  return {
    schemaVersion: '1',
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    version: faker.system.semver(),
    buildId: faker.string.alphanumeric(8),
    channel: faker.helpers.arrayElement(ALL_CHANNELS),
    framework: faker.helpers.arrayElement(ALL_FRAMEWORKS),
    remoteEntryUrl: faker.internet.url(),
    createdAt: faker.date.recent().toISOString(),
  };
}

export function anAppManifest(
  overrides: Partial<AtlasManifest> = {},
): AtlasManifest {
  return {
    ...anArtifactManifestBase(),
    kind: 'app',
    exposes: { entry: `./${faker.word.noun()}` },
    requiredHostSdkVersion: `^${faker.system.semver()}`,
    supportedHosts: [faker.string.uuid()],
    placements: [],
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

export function aVersionOf<T extends ArtifactManifest>(
  manifest: T,
  overrides: Partial<T> = {},
): T {
  const { id, name } = manifest;

  return {
    ...(manifest.kind === 'host'
      ? aHostManifest({ id, name })
      : anAppManifest({
          id,
          name,
          supportedHosts: manifest.supportedHosts,
        })),
    ...overrides,
  } as T;
}
