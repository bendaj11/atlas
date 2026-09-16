import { faker } from '@faker-js/faker';
import type { AtlasPlacement } from '../manifest/atlas-placement/atlas-placement.js';
import { ATLAS_DOM_ISOLATIONS } from '../manifest/atlas-dom-isolation.js';
import { ATLAS_FRAMEWORKS } from '../manifest/atlas-framework.js';
import { anIdentifier } from '../manifest/manifest.testkit.js';
import {
  ATLAS_IMMUTABLE_CACHE_CONTROL,
  type AtlasAppArtifactManifest,
  type AtlasEnvironmentDeployment,
  type AtlasHostArtifactManifest,
  type AtlasHostDeploymentManifest,
  type AtlasManifestDescriptor,
  type AtlasPayloadFileDescriptor,
  type AtlasPublishedWidgetManifest,
} from './atlas-publication.js';

export function aSha256Digest(): `sha256:${string}` {
  return `sha256:${faker.string.hexadecimal({ length: 64, prefix: '' }).toLowerCase()}`;
}

export function aReleaseVersion(): string {
  return faker.system.semver();
}

export function aRelativePath(extension: string): string {
  return `${faker.lorem.slug()}.${extension}`;
}

export function aPayloadFile(
  overrides: Partial<AtlasPayloadFileDescriptor> = {},
): AtlasPayloadFileDescriptor {
  return {
    path: aRelativePath('js'),
    digest: aSha256Digest(),
    size: faker.number.int({ min: 1, max: 100000 }),
    mediaType: 'text/javascript; charset=utf-8',
    cacheControl: ATLAS_IMMUTABLE_CACHE_CONTROL,
    role: 'script',
    ...overrides,
  };
}

export function aRemoteEntryFile(
  overrides: Partial<AtlasPayloadFileDescriptor> = {},
): AtlasPayloadFileDescriptor {
  return aPayloadFile({ role: 'remote-entry', ...overrides });
}

export function aStylesheetFile(
  overrides: Partial<AtlasPayloadFileDescriptor> = {},
): AtlasPayloadFileDescriptor {
  return aPayloadFile({
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
    id: anIdentifier(),
    name: faker.commerce.productName(),
    ownerAppId: anIdentifier(),
    framework: faker.helpers.arrayElement(ATLAS_FRAMEWORKS),
    expose: `./${faker.lorem.slug()}`,
    ...overrides,
  };
}

export function anAppArtifactManifest(
  overrides: Partial<AtlasAppArtifactManifest> = {},
): AtlasAppArtifactManifest {
  const entry = aRemoteEntryFile();
  const placements: AtlasPlacement[] = overrides.placements ?? [];
  const supportedHosts = placements.length
    ? [...new Set(placements.map((placement) => placement.hostId))]
    : [anIdentifier()];

  return {
    schemaVersion: '2',
    kind: 'app-artifact',
    id: anIdentifier(),
    name: faker.commerce.productName(),
    release: { version: aReleaseVersion() },
    framework: faker.helpers.arrayElement(ATLAS_FRAMEWORKS),
    entryPath: entry.path,
    exposes: { entry: './entry' },
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
    id: anIdentifier(),
    name: faker.company.name(),
    release: { version: aReleaseVersion() },
    framework: faker.helpers.arrayElement(ATLAS_FRAMEWORKS),
    entryPath: entry.path,
    exposes: { entry: './host' },
    requiredLoaderApiVersion: `^${faker.system.semver()}`,
    files: [entry],
    ...overrides,
  };
}

export function aManifestDescriptor(
  overrides: Partial<AtlasManifestDescriptor> = {},
): AtlasManifestDescriptor {
  return {
    path: aRelativePath('json'),
    digest: aSha256Digest(),
    size: faker.number.int({ min: 1, max: 100000 }),
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
    hostId: anIdentifier(),
    environment: faker.lorem.slug(),
    deploymentRevision: aSha256Digest(),
    host: aManifestDescriptor(),
    apps: [aManifestDescriptor()],
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
    updatedAt: faker.date.past().toISOString(),
    hosts: { [anIdentifier()]: { version: aReleaseVersion() } },
    apps: { [anIdentifier()]: { version: aReleaseVersion() } },
    ...overrides,
  };
}
