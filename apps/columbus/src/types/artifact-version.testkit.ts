import { faker } from '@faker-js/faker';
import type { ArtifactVersion } from './artifact-version';

const CHANNELS: ArtifactVersion['channel'][] = ['production', 'pr', 'local'];
const FRAMEWORKS: ArtifactVersion['framework'][] = ['angular', 'react', 'vue'];

function anArtifactVersion(
  overrides: Partial<ArtifactVersion> = {},
): ArtifactVersion {
  return {
    schemaVersion: '1',
    kind: faker.helpers.arrayElement(['app', 'host']),
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    version: faker.system.semver(),
    buildId: faker.string.alphanumeric(8),
    channel: faker.helpers.arrayElement(CHANNELS),
    framework: faker.helpers.arrayElement(FRAMEWORKS),
    remoteEntryUrl: faker.internet.url(),
    createdAt: faker.date.recent().toISOString(),
    exposes: { entry: `./${faker.word.noun()}` },
    requiredHostSdkVersion: `^${faker.system.semver()}`,
    supportedHosts: [faker.string.uuid()],
    placements: [],
    ...overrides,
  };
}

export function anAppArtifactVersion(
  overrides: Partial<ArtifactVersion> = {},
): ArtifactVersion {
  return anArtifactVersion({ kind: 'app', ...overrides });
}

export function aHostArtifactVersion(
  overrides: Partial<ArtifactVersion> = {},
): ArtifactVersion {
  return anArtifactVersion({ kind: 'host', ...overrides });
}

export function aVersionOf(
  manifest: ArtifactVersion,
  overrides: Partial<ArtifactVersion> = {},
): ArtifactVersion {
  const { kind, id, name, supportedHosts } = manifest;

  return anArtifactVersion({
    kind,
    id,
    name,
    ...(supportedHosts ? { supportedHosts } : {}),
    ...overrides,
  });
}
