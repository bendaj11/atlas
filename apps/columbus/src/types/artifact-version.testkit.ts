import { faker } from '@faker-js/faker';
import type {
  AtlasArtifactManifestBase,
  AtlasHostManifest,
  AtlasManifest,
} from '@atlas/schema';
import type { ArtifactVersion } from './artifact-version';

const CHANNELS: ArtifactVersion['channel'][] = ['production', 'pr', 'local'];
const FRAMEWORKS: ArtifactVersion['framework'][] = ['angular', 'react', 'vue'];

function anArtifactManifestBase(): Omit<AtlasArtifactManifestBase, 'kind'> {
  return {
    schemaVersion: '1',
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    version: faker.system.semver(),
    buildId: faker.string.alphanumeric(8),
    channel: faker.helpers.arrayElement(CHANNELS),
    framework: faker.helpers.arrayElement(FRAMEWORKS),
    remoteEntryUrl: faker.internet.url(),
    createdAt: faker.date.recent().toISOString(),
  };
}

export function anAppArtifactVersion(
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

export function aHostArtifactVersion(
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

export function aVersionOf<T extends ArtifactVersion>(
  manifest: T,
  overrides: Partial<T> = {},
): T {
  const { id, name } = manifest;

  return {
    ...(manifest.kind === 'host'
      ? aHostArtifactVersion({ id, name })
      : anAppArtifactVersion({
          id,
          name,
          supportedHosts: manifest.supportedHosts,
        })),
    ...overrides,
  } as T;
}
