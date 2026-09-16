import { faker } from '@faker-js/faker';
import type { AtlasExportedWidgetManifest } from './atlas-exported-widget-manifest.js';
import type { AtlasManifest } from './atlas-manifest.js';
import type { AtlasPlacement } from './atlas-placement/atlas-placement.js';
import type { AtlasRouteContribution } from './atlas-route-contribution.js';
import type { AtlasStylesheet } from './atlas-stylesheet.js';
import { ATLAS_DOM_ISOLATIONS } from './atlas-dom-isolation.js';
import { ATLAS_FRAMEWORKS } from './atlas-framework.js';
import { ATLAS_ROUTE_MATCHES } from './atlas-route-contribution.js';
import { ATLAS_VERSION_CHANNELS } from './atlas-version-channel.js';

export function anIdentifier(): string {
  return faker.string.uuid();
}

export function aSha256Integrity(): string {
  return `sha256-${faker.string.alphanumeric(43)}=`;
}

export function aRoutePath(): string {
  return `/${faker.lorem.slug()}`;
}

export function aStylesheet(
  overrides: Partial<AtlasStylesheet> = {},
): AtlasStylesheet {
  return {
    href: faker.internet.url(),
    integrity: aSha256Integrity(),
    ...overrides,
  };
}

export function aRouteContribution(
  overrides: Partial<AtlasRouteContribution> = {},
): AtlasRouteContribution {
  return {
    path: aRoutePath(),
    match: faker.helpers.arrayElement(ATLAS_ROUTE_MATCHES),
    title: faker.lorem.words(),
    nav: {
      label: faker.lorem.word(),
      order: faker.number.int({ max: 100 }),
      visible: faker.datatype.boolean(),
    },
    ...overrides,
  };
}

export function aRoutePlacement(
  overrides: Partial<AtlasPlacement> = {},
): AtlasPlacement {
  return {
    id: anIdentifier(),
    kind: 'route',
    hostId: anIdentifier(),
    route: aRouteContribution(),
    ...overrides,
  };
}

export function aSlotPlacement(
  overrides: Partial<AtlasPlacement> = {},
): AtlasPlacement {
  return {
    id: anIdentifier(),
    kind: 'slot',
    hostId: anIdentifier(),
    slot: faker.lorem.slug(),
    ...overrides,
  };
}

export function anExportedWidget(
  overrides: Partial<AtlasExportedWidgetManifest> = {},
): AtlasExportedWidgetManifest {
  return {
    schemaVersion: '1',
    contractVersion: '1',
    id: anIdentifier(),
    name: faker.commerce.productName(),
    ownerAppId: anIdentifier(),
    framework: faker.helpers.arrayElement(ATLAS_FRAMEWORKS),
    remoteEntryUrl: faker.internet.url(),
    expose: `./${faker.lorem.slug()}`,
    ...overrides,
  };
}

export function anAppManifest(
  overrides: Partial<AtlasManifest> = {},
): AtlasManifest {
  const placements = overrides.placements ?? [];
  const supportedHosts = placements.length
    ? [...new Set(placements.map((placement) => placement.hostId))]
    : [anIdentifier()];

  return {
    schemaVersion: '1',
    kind: 'app',
    id: anIdentifier(),
    name: faker.commerce.productName(),
    version: faker.system.semver(),
    buildId: faker.string.uuid(),
    channel: faker.helpers.arrayElement(ATLAS_VERSION_CHANNELS),
    framework: faker.helpers.arrayElement(ATLAS_FRAMEWORKS),
    isolation: faker.helpers.arrayElement(ATLAS_DOM_ISOLATIONS),
    remoteEntryUrl: faker.internet.url(),
    exposes: { entry: './entry' },
    requiredHostSdkVersion: `^${faker.system.semver()}`,
    supportedHosts,
    placements,
    createdAt: faker.date.past().toISOString(),
    ...overrides,
  };
}
