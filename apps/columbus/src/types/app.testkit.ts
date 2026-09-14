import { faker } from '@faker-js/faker';
import type { Artifact, Manifest } from './app.js';
import { getArtifactKey } from './contracts.js';

export function createManifest(overrides: Partial<Manifest> = {}): Manifest {
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

export function createArtifact(overrides: Partial<Artifact> = {}): Artifact {
  const productionManifest = overrides.productionManifest ?? createManifest();

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
