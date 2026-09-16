import { faker } from '@faker-js/faker';
import type {
  AtlasAppArtifactManifest,
  AtlasStaticRegistry,
} from '@atlas/schema';
import { sha256Digest } from '../shared/digest/digest.js';
import {
  descriptorFor,
  manifestBytes,
  publishArtifact,
} from './static-registry/static-registry.js';

const REMOTE_ENTRY_BYTES = new TextEncoder().encode('{}\n');

export function anAppArtifactManifest(
  overrides: Partial<AtlasAppArtifactManifest> = {},
): AtlasAppArtifactManifest {
  return {
    schemaVersion: '2',
    kind: 'app-artifact',
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    packageName: faker.word.noun().toLowerCase(),
    release: { version: faker.system.semver() },
    framework: faker.helpers.arrayElement(['react', 'angular']),
    entryPath: 'remoteEntry.json',
    exposes: { entry: './entry' },
    files: [
      {
        path: 'remoteEntry.json',
        digest: sha256Digest(REMOTE_ENTRY_BYTES),
        size: REMOTE_ENTRY_BYTES.byteLength,
        mediaType: 'application/json',
        cacheControl: 'public, max-age=31536000, immutable',
        role: 'remote-entry',
      },
    ],
    requiredHostSdkVersion: '^1.0.0',
    supportedHosts: ['*'],
    placements: [],
    ...overrides,
  };
}

export function aRegistryWith(
  manifest: AtlasAppArtifactManifest = anAppArtifactManifest(),
): AtlasStaticRegistry {
  const bytes = manifestBytes(manifest);

  return publishArtifact(
    undefined,
    manifest,
    descriptorFor(`apps/${manifest.id}/manifest.json`, bytes),
  ).registry;
}
