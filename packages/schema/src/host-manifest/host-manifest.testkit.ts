import { faker } from '@faker-js/faker';
import type { AtlasHostManifest } from './atlas-host-manifest.js';
import { ATLAS_FRAMEWORKS } from '../manifest/atlas-framework.js';
import { ATLAS_VERSION_CHANNELS } from '../manifest/atlas-version-channel.js';
import { anIdentifier } from '../manifest/manifest.testkit.js';

export function aHostManifest(
  overrides: Partial<AtlasHostManifest> = {},
): AtlasHostManifest {
  return {
    schemaVersion: '1',
    kind: 'host',
    id: anIdentifier(),
    name: faker.company.name(),
    version: faker.system.semver(),
    buildId: faker.string.uuid(),
    channel: faker.helpers.arrayElement(ATLAS_VERSION_CHANNELS),
    framework: faker.helpers.arrayElement(ATLAS_FRAMEWORKS),
    remoteEntryUrl: faker.internet.url(),
    exposes: { entry: './host' },
    requiredLoaderApiVersion: `^${faker.system.semver()}`,
    createdAt: faker.date.past().toISOString(),
    ...overrides,
  };
}
