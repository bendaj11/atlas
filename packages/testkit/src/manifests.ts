import { faker } from '@faker-js/faker';
import {
  ATLAS_DOM_ISOLATIONS,
  ATLAS_FRAMEWORKS,
  ATLAS_ROUTE_MATCHES,
  ATLAS_VERSION_CHANNELS,
  type AtlasArtifactManifestBase,
  type AtlasExportedWidgetManifest,
  type AtlasHostManifest,
  type AtlasManifest,
  type AtlasPlacement,
  type AtlasRouteContribution,
  type AtlasStylesheet,
  type AtlasVersionChannel,
} from '@atlas/schema';

type ArtifactManifest = AtlasManifest | AtlasHostManifest;

export const PUBLISHED_CHANNELS: readonly AtlasVersionChannel[] = [
  'production',
  'pr',
];

function anArtifactManifestBase(): Omit<AtlasArtifactManifestBase, 'kind'> {
  return {
    schemaVersion: '1',
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    version: faker.system.semver(),
    buildId: faker.string.alphanumeric(8),
    channel: faker.helpers.arrayElement(ATLAS_VERSION_CHANNELS),
    framework: faker.helpers.arrayElement(ATLAS_FRAMEWORKS),
    remoteEntryUrl: faker.internet.url(),
    createdAt: faker.date.recent().toISOString(),
  };
}

export function anAppManifest(
  overrides: Partial<AtlasManifest> = {},
): AtlasManifest {
  const placements = overrides.placements ?? [];
  const supportedHosts = placements.length
    ? [...new Set(placements.map((placement) => placement.hostId))]
    : [faker.string.uuid()];

  return {
    ...anArtifactManifestBase(),
    kind: 'app',
    isolation: faker.helpers.arrayElement(ATLAS_DOM_ISOLATIONS),
    exposes: { entry: `./${faker.word.noun()}` },
    requiredHostSdkVersion: `^${faker.system.semver()}`,
    supportedHosts,
    placements,
    ...overrides,
  };
}

export function aHostManifest(
  overrides: Partial<AtlasHostManifest> = {},
): AtlasHostManifest {
  return {
    ...anArtifactManifestBase(),
    kind: 'host',
    exposes: { entry: `./${faker.word.noun()}` },
    requiredLoaderApiVersion: `^${faker.system.semver()}`,
    ...overrides,
  };
}

export function aVersionOf<T extends ArtifactManifest>(
  manifest: T,
  overrides: Partial<T> = {},
): T {
  const { id, name } = manifest;

  return {
    ...(manifest.kind === 'host'
      ? aHostManifest({ id, name })
      : anAppManifest({
          id,
          name,
          supportedHosts: manifest.supportedHosts,
        })),
    ...overrides,
  } as T;
}

export function aSha256Integrity(): string {
  return `sha256-${faker.string.alphanumeric(43)}=`;
}

export function aRouteContribution(
  overrides: Partial<AtlasRouteContribution> = {},
): AtlasRouteContribution {
  return {
    path: `/${faker.lorem.slug()}`,
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
  overrides: Partial<AtlasPlacement> & {
    route?: Partial<AtlasRouteContribution>;
  } = {},
): AtlasPlacement {
  const { route, ...placement } = overrides;

  return {
    id: faker.string.uuid(),
    kind: 'route',
    hostId: faker.string.uuid(),
    route: aRouteContribution(route),
    ...placement,
  };
}

export function aSlotPlacement(
  overrides: Partial<AtlasPlacement> = {},
): AtlasPlacement {
  return {
    id: faker.string.uuid(),
    kind: 'slot',
    hostId: faker.string.uuid(),
    slot: faker.lorem.slug(),
    ...overrides,
  };
}

export function anExportedWidgetManifest(
  overrides: Partial<AtlasExportedWidgetManifest> = {},
): AtlasExportedWidgetManifest {
  return {
    schemaVersion: '1',
    contractVersion: '1',
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    ownerAppId: faker.string.uuid(),
    framework: faker.helpers.arrayElement(ATLAS_FRAMEWORKS),
    remoteEntryUrl: faker.internet.url(),
    expose: `./${faker.lorem.slug()}`,
    ...overrides,
  };
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
