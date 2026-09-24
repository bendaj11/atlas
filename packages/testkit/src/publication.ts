import { faker } from '@faker-js/faker';
import {
  ATLAS_DOM_ISOLATIONS,
  ATLAS_FRAMEWORKS,
  ATLAS_IMMUTABLE_CACHE_CONTROL,
  type AtlasAppArtifactManifest,
  type AtlasEnvironmentDeployment,
  type AtlasHostArtifactManifest,
  type AtlasHostDeploymentManifest,
  type AtlasManifestDescriptor,
  type AtlasPayloadFileDescriptor,
  type AtlasPublishedWidgetManifest,
  type AtlasRegistryArtifact,
  type AtlasStaticRegistry,
} from '@atlas/schema';

export function aSha256Digest(): `sha256:${string}` {
  return `sha256:${faker.string.hexadecimal({ length: 64, prefix: '' }).toLowerCase()}`;
}

export function aRegistryUrl(): string {
  return `https://${faker.internet.domainName()}/${faker.lorem.slug()}`;
}

export function aReleaseVersion(): string {
  return faker.system.semver();
}

function aRelativePath(extension: string): string {
  return `${faker.lorem.slug()}.${extension}`;
}

export function aManifestDescriptor(
  overrides: Partial<AtlasManifestDescriptor> = {},
): AtlasManifestDescriptor {
  return {
    path: aRelativePath('json'),
    digest: aSha256Digest(),
    size: faker.number.int({ min: 1, max: 100_000 }),
    mediaType: 'application/json',
    ...overrides,
  };
}

export function aHostDeploymentManifest(
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
    path: aRelativePath('js'),
    digest: aSha256Digest(),
    size: faker.number.int({ min: 1, max: 100_000 }),
    mediaType: 'text/javascript; charset=utf-8',
    cacheControl: ATLAS_IMMUTABLE_CACHE_CONTROL,
    role: 'script',
    ...overrides,
  };
}

export function aRemoteEntryFile(
  overrides: Partial<AtlasPayloadFileDescriptor> = {},
): AtlasPayloadFileDescriptor {
  return aPayloadFileDescriptor({ role: 'remote-entry', ...overrides });
}

export function aStylesheetFile(
  overrides: Partial<AtlasPayloadFileDescriptor> = {},
): AtlasPayloadFileDescriptor {
  return aPayloadFileDescriptor({
    path: aRelativePath('css'),
    mediaType: 'text/css; charset=utf-8',
    role: 'stylesheet',
    ...overrides,
  });
}

export function aPublishedWidget(
  overrides: Partial<AtlasPublishedWidgetManifest> = {},
): AtlasPublishedWidgetManifest {
  return {
    schemaVersion: '1',
    contractVersion: '1',
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    ownerAppId: faker.string.uuid(),
    framework: faker.helpers.arrayElement(ATLAS_FRAMEWORKS),
    expose: `./${faker.lorem.slug()}`,
    ...overrides,
  };
}

export function anAppArtifactManifest(
  overrides: Partial<AtlasAppArtifactManifest> = {},
): AtlasAppArtifactManifest {
  const entry = aRemoteEntryFile();
  const placements = overrides.placements ?? [];
  const supportedHosts = placements.length
    ? [...new Set(placements.map((placement) => placement.hostId))]
    : [faker.string.uuid()];

  return {
    schemaVersion: '2',
    kind: 'app-artifact',
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    packageName: faker.word.noun().toLowerCase(),
    release: { version: aReleaseVersion() },
    framework: faker.helpers.arrayElement(ATLAS_FRAMEWORKS),
    entryPath: entry.path,
    exposes: { entry: `./${faker.word.noun()}` },
    isolation: faker.helpers.arrayElement(ATLAS_DOM_ISOLATIONS),
    requiredHostSdkVersion: `^${faker.system.semver()}`,
    supportedHosts,
    placements,
    files: [entry],
    ...overrides,
  };
}

export function aHostArtifactManifest(
  overrides: Partial<AtlasHostArtifactManifest> = {},
): AtlasHostArtifactManifest {
  const entry = aRemoteEntryFile({
    path: aRelativePath('json'),
    mediaType: 'application/json; charset=utf-8',
  });

  return {
    schemaVersion: '2',
    kind: 'host-artifact',
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    packageName: faker.word.noun().toLowerCase(),
    release: { version: aReleaseVersion() },
    framework: faker.helpers.arrayElement(ATLAS_FRAMEWORKS),
    entryPath: entry.path,
    exposes: { entry: `./${faker.word.noun()}` },
    requiredLoaderApiVersion: `^${faker.system.semver()}`,
    files: [entry],
    ...overrides,
  };
}

export function anEnvironmentDeployment(
  overrides: Partial<AtlasEnvironmentDeployment> = {},
): AtlasEnvironmentDeployment {
  return {
    schemaVersion: 'v1',
    environment: faker.lorem.slug(),
    revision: aSha256Digest(),
    updatedAt: faker.date.recent().toISOString(),
    hosts: {},
    apps: {},
    ...overrides,
  };
}
