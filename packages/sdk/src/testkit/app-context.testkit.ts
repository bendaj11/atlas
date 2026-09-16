import { faker } from '@faker-js/faker';
import type { AtlasExportedWidgetManifest, AtlasManifest } from '@atlas/schema';
import type { AtlasAppContext } from '../lifecycle.js';
import { createRouteContext } from '../navigation/route-context/route-context.js';
import { createScopedNavigation } from '../navigation/scoped-navigation/scoped-navigation.js';
import { aMemoryNavigation } from './navigation.testkit.js';

export const ALL_FRAMEWORKS: readonly AtlasManifest['framework'][] = [
  'angular',
  'react',
  'vue',
];
export const ALL_CHANNELS: readonly AtlasManifest['channel'][] = [
  'production',
  'pr',
  'local',
];

export function anAppManifest(
  overrides: Partial<AtlasManifest> = {},
): AtlasManifest {
  return {
    schemaVersion: '1',
    kind: 'app',
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    version: faker.system.semver(),
    buildId: faker.string.alphanumeric(8),
    channel: faker.helpers.arrayElement(ALL_CHANNELS),
    framework: faker.helpers.arrayElement(ALL_FRAMEWORKS),
    remoteEntryUrl: `${faker.internet.url()}/${faker.system.semver()}/remoteEntry.json`,
    exposes: { entry: `./${faker.word.noun()}` },
    requiredHostSdkVersion: `^${faker.system.semver()}`,
    supportedHosts: [faker.string.uuid()],
    placements: [],
    createdAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}

export function anExportedWidgetManifest(
  overrides: Partial<AtlasExportedWidgetManifest> = {},
): AtlasExportedWidgetManifest {
  return {
    schemaVersion: '1',
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    ownerAppId: faker.string.uuid(),
    framework: faker.helpers.arrayElement(ALL_FRAMEWORKS),
    remoteEntryUrl: `${faker.internet.url()}/remoteEntry.json`,
    expose: `./widgets/${faker.lorem.slug()}`,
    contractVersion: '1',
    ...overrides,
  };
}

export function anAppContext(
  overrides: Partial<AtlasAppContext> = {},
): AtlasAppContext {
  const path = overrides.path ?? `/${faker.lorem.slug()}`;
  const hostNavigation = aMemoryNavigation(path);

  return {
    manifest: anAppManifest(),
    hostId: faker.string.uuid(),
    path,
    navigation: createScopedNavigation(path, hostNavigation),
    route: createRouteContext(path, hostNavigation),
    loading: {
      show: () => undefined,
      hide: () => undefined,
      waitUntilReady: () => () => undefined,
    },
    ...overrides,
  };
}
