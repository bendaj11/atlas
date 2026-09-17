import { faker } from '@faker-js/faker';
import type {
  AtlasAppArtifactManifest,
  AtlasArtifactManifestBaseV2,
  AtlasEnvironmentDeployment,
  AtlasHostArtifactManifest,
  AtlasHostDeploymentManifest,
  AtlasManifestDescriptor,
  AtlasPayloadFileDescriptor,
  AtlasRegistryArtifact,
  AtlasStaticRegistry,
} from '@atlas/schema';
import { ALL_FRAMEWORKS } from './manifests.js';

export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const ALL_PAYLOAD_FILE_ROLES: readonly AtlasPayloadFileDescriptor['role'][] =
  ['remote-entry', 'script', 'stylesheet', 'asset', 'source-map'];

export function aSha256Digest(): `sha256:${string}` {
  return `sha256:${faker.string.hexadecimal({ length: 64, prefix: '' }).toLowerCase()}`;
}

export function aRegistryUrl(): string {
  return `https://${faker.internet.domainName()}/${faker.lorem.slug()}`;
}

export function aManifestDescriptor(
  overrides: Partial<AtlasManifestDescriptor> = {},
): AtlasManifestDescriptor {
  return {
    path: `${faker.lorem.slug()}/manifest.json`,
    digest: aSha256Digest(),
    size: faker.number.int({ min: 1, max: 100_000 }),
    mediaType: 'application/json',
    ...overrides,
  };
}

export function aDeploymentManifest(
  overrides: Partial<AtlasHostDeploymentManifest> = {},
): AtlasHostDeploymentManifest {
  return {
    schemaVersion: 'v1',
    kind: 'host-deployment',
    hostId: faker.string.uuid(),
    environment: faker.word.noun(),
    deploymentRevision: aSha256Digest(),
    host: aManifestDescriptor(),
    apps: [aManifestDescriptor()],
    ...overrides,
  };
}

export function aRegistryArtifact(
  overrides: Partial<AtlasRegistryArtifact> = {},
): AtlasRegistryArtifact {
  return {
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    packageName: faker.word.noun().toLowerCase(),
    releases: {},
    previews: {},
    ...overrides,
  };
}

export function aStaticRegistry(
  overrides: Partial<AtlasStaticRegistry> = {},
): AtlasStaticRegistry {
  return {
    schemaVersion: '2',
    revision: aSha256Digest(),
    updatedAt: faker.date.recent().toISOString(),
    hosts: {},
    apps: {},
    ...overrides,
  };
}

export function aPayloadFileDescriptor(
  overrides: Partial<AtlasPayloadFileDescriptor> = {},
): AtlasPayloadFileDescriptor {
  return {
    path: `${faker.system.fileName({ extensionCount: 0 })}.js`,
    digest: aSha256Digest(),
    size: faker.number.int({ min: 1, max: 100_000 }),
    mediaType: 'application/javascript',
    cacheControl: IMMUTABLE_CACHE_CONTROL,
    role: faker.helpers.arrayElement(ALL_PAYLOAD_FILE_ROLES),
    ...overrides,
  };
}

function anArtifactManifestBaseV2(): Omit<AtlasArtifactManifestBaseV2, 'kind'> {
  const entryPath = 'remoteEntry.json';

  return {
    schemaVersion: '2',
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    packageName: faker.word.noun().toLowerCase(),
    release: { version: faker.system.semver() },
    framework: faker.helpers.arrayElement(ALL_FRAMEWORKS),
    entryPath,
    exposes: { entry: `./${faker.word.noun()}` },
    files: [
      aPayloadFileDescriptor({
        path: entryPath,
        mediaType: 'application/json',
        role: 'remote-entry',
      }),
    ],
  };
}

export function anAppArtifactManifest(
  overrides: Partial<AtlasAppArtifactManifest> = {},
): AtlasAppArtifactManifest {
  return {
    ...anArtifactManifestBaseV2(),
    kind: 'app-artifact',
    requiredHostSdkVersion: `^${faker.system.semver()}`,
    supportedHosts: [faker.string.uuid()],
    placements: [],
    ...overrides,
  };
}

export function aHostArtifactManifest(
  overrides: Partial<AtlasHostArtifactManifest> = {},
): AtlasHostArtifactManifest {
  return {
    ...anArtifactManifestBaseV2(),
    kind: 'host-artifact',
    requiredLoaderApiVersion: `^${faker.system.semver()}`,
    ...overrides,
  };
}

export function anEnvironmentDeployment(
  overrides: Partial<AtlasEnvironmentDeployment> = {},
): AtlasEnvironmentDeployment {
  return {
    schemaVersion: 'v1',
    environment: faker.word.noun(),
    revision: aSha256Digest(),
    updatedAt: faker.date.recent().toISOString(),
    hosts: {},
    apps: {},
    ...overrides,
  };
}
