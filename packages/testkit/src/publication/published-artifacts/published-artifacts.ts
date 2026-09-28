import { faker } from '@faker-js/faker';
import {
  ATLAS_DOM_ISOLATIONS,
  ATLAS_FRAMEWORKS,
  type AtlasAppArtifactManifest,
  type AtlasHostArtifactManifest,
  type AtlasPublishedWidgetManifest,
} from '@atlas/schema';
import { aRelativePath, aReleaseVersion } from '../identifiers/identifiers.js';
import { aRemoteEntryFile } from '../payload-files/payload-files.js';

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
