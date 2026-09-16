import type {
  AtlasArtifactManifestBase,
  AtlasFramework,
  AtlasHostCatalog,
  AtlasHostDeploymentManifest,
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
  AtlasManifestDescriptor,
  AtlasStaticRegistry,
  AtlasVersionChannel,
} from '@atlas/schema';
import { faker } from '@faker-js/faker';

export const ALL_CHANNELS: readonly AtlasVersionChannel[] = [
  'production',
  'pr',
  'local',
];
export const PUBLISHED_CHANNELS: readonly AtlasVersionChannel[] = [
  'production',
  'pr',
];
export const ALL_FRAMEWORKS: readonly AtlasFramework[] = [
  'angular',
  'react',
  'vue',
];

export function aSha256Digest(): `sha256:${string}` {
  return `sha256:${faker.string.hexadecimal({ length: 64, prefix: '' }).toLowerCase()}`;
}

export function aRegistryUrl(): string {
  return `https://${faker.internet.domainName()}/${faker.lorem.slug()}`;
}

export function aRuntimeConfig(
  overrides: Partial<AtlasHostRuntimeConfig> = {},
): AtlasHostRuntimeConfig {
  return {
    schemaVersion: 'v1',
    hostId: faker.string.uuid(),
    environment: faker.lorem.slug(),
    artifactRegistryUrl: aRegistryUrl(),
    ...overrides,
  };
}

function aManifestBase(): Omit<AtlasArtifactManifestBase, 'kind'> {
  return {
    schemaVersion: '1',
    id: faker.string.uuid(),
    name: faker.company.name(),
    version: faker.system.semver(),
    buildId: faker.string.uuid(),
    channel: faker.helpers.arrayElement(ALL_CHANNELS),
    framework: faker.helpers.arrayElement(ALL_FRAMEWORKS),
    remoteEntryUrl: faker.internet.url(),
    createdAt: faker.date.past().toISOString(),
  };
}

export function aHostManifest(
  overrides: Partial<AtlasHostManifest> = {},
): AtlasHostManifest {
  return {
    ...aManifestBase(),
    kind: 'host',
    exposes: { entry: `./${faker.lorem.word()}` },
    requiredLoaderApiVersion: '^1.0.0',
    ...overrides,
  };
}

export function aPublishedHostManifestFor(
  runtime: Pick<AtlasHostRuntimeConfig, 'hostId' | 'artifactRegistryUrl'>,
  overrides: Partial<AtlasHostManifest> = {},
): AtlasHostManifest {
  return aHostManifest({
    id: runtime.hostId,
    channel: faker.helpers.arrayElement(PUBLISHED_CHANNELS),
    remoteEntryUrl: `${runtime.artifactRegistryUrl}/${faker.system.fileName()}`,
    ...overrides,
  });
}

export function anAppManifest(
  overrides: Partial<AtlasManifest> = {},
): AtlasManifest {
  return {
    ...aManifestBase(),
    kind: 'app',
    exposes: { entry: `./${faker.lorem.word()}` },
    requiredHostSdkVersion: '^1.0.0',
    supportedHosts: [faker.string.uuid()],
    placements: [],
    ...overrides,
  };
}

export function aHostCatalog(
  overrides: Partial<AtlasHostCatalog> = {},
): AtlasHostCatalog {
  const host = overrides.host ?? aHostManifest();

  return {
    schemaVersion: '1',
    hostId: host.id,
    revision: aSha256Digest(),
    generatedAt: faker.date.past().toISOString(),
    host,
    apps: [anAppManifest()],
    ...overrides,
  };
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
    environment: faker.lorem.slug(),
    deploymentRevision: aSha256Digest(),
    host: aManifestDescriptor(),
    apps: [aManifestDescriptor()],
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
