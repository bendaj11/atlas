import { faker } from '@faker-js/faker';
import type {
  Artifact,
  ArtifactConfiguration,
  ColumbusState,
  ArtifactVersion,
} from './app';
import { type AtlasHostData as HostData, getArtifactKey } from './contracts';

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

export function anArtifact(overrides: Partial<Artifact> = {}): Artifact {
  const productionArtifactVersion =
    overrides.productionArtifactVersion ?? anAppArtifactVersion();

  return {
    key: getArtifactKey(productionArtifactVersion),
    productionArtifactVersion,
    selectedArtifactVersion: undefined,
    overrideType: undefined,
    sourceDescription: '',
    loadError: undefined,
    overrideEnabled: false,
    canToggle: false,
    visible: false,
    ...overrides,
  };
}

export function anArtifactConfiguration(
  overrides: Partial<ArtifactConfiguration> = {},
): ArtifactConfiguration {
  const artifact = anArtifact(overrides);

  return {
    ...artifact,
    hostId: faker.string.uuid(),
    productionArtifactVersions: [artifact.productionArtifactVersion],
    prArtifactVersions: [],
    ...overrides,
  };
}

export function aHostData(overrides: Partial<HostData> = {}): HostData {
  const hostId = faker.string.uuid();

  return {
    config: {
      schemaVersion: 'v1',
      hostId,
      environment: 'production',
      artifactRegistryUrl: faker.internet.url(),
    },
    pageUrl: faker.internet.url(),
    catalog: {
      schemaVersion: '1',
      hostId,
      revision: faker.string.uuid(),
      host: aHostArtifactVersion({ id: hostId }),
      apps: [],
    },
    overrides: undefined,
    overrideScope: undefined,
    versions: {},
    runtimeErrors: [],
    versionErrors: [],
    ...overrides,
  };
}

export function aColumbusState(
  overrides: Partial<ColumbusState> = {},
): ColumbusState {
  return {
    hostData: aHostData(),
    tabId: faker.number.int({ min: 1, max: 1000 }),
    enabledArtifactVersionOverrides: new Map(),
    disabledArtifactVersionOverrides: new Map(),
    clearedLocalArtifactIds: new Set(),
    scope: 'all',
    ...overrides,
  };
}
