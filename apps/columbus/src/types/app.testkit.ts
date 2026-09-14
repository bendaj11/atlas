import { faker } from '@faker-js/faker';
import type { Artifact, ExtensionSession, Manifest } from './app';
import { type AtlasHostData as HostData, getArtifactKey } from './contracts';

export function aManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    schemaVersion: '1',
    kind: 'app',
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    version: faker.system.semver(),
    buildId: faker.string.alphanumeric(8),
    channel: 'production',
    framework: 'react',
    remoteEntryUrl: faker.internet.url(),
    ...overrides,
  };
}

export function anArtifact(overrides: Partial<Artifact> = {}): Artifact {
  const productionManifest = overrides.productionManifest ?? aManifest();

  return {
    id: getArtifactKey(productionManifest),
    productionManifest,
    selectedManifest: undefined,
    overrideType: 'none',
    sourceDescription: '',
    loadError: undefined,
    overrideEnabled: false,
    canToggle: false,
    visible: false,
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
      host: aManifest({ kind: 'host', id: hostId }),
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

export function aSession(
  overrides: Partial<ExtensionSession> = {},
): ExtensionSession {
  return {
    hostData: aHostData(),
    tabId: faker.number.int({ min: 1, max: 1000 }),
    activeOverrides: new Map(),
    disabledOverrides: new Map(),
    suppressedArtifactIds: new Set(),
    scope: 'all',
    ...overrides,
  };
}
