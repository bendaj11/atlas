import type {
  AtlasDevelopmentOfferIds,
  AtlasHostCatalog,
  AtlasHostManifest,
  AtlasManifest,
  AtlasRuntimeOverride,
} from '@atlas/schema';
import { LOCAL_HOST_PLACEHOLDER_PORT } from '../constants.js';
import type {
  AtlasDevOverrideDocument,
  AtlasDevSessionDocument,
} from '../types.js';

export function createLocalDevCatalog(
  document: AtlasDevOverrideDocument,
): AtlasHostCatalog {
  const host =
    document.hostOverride ??
    createLocalHostPlaceholder({
      hostId: document.hostId,
      createdAt: document.generatedAt,
    });

  return {
    schemaVersion: '1',
    hostId: document.hostId,
    revision: `local:${document.generatedAt}`,
    generatedAt: document.generatedAt,
    host,
    apps: dedupeManifests(document.overrides),
  };
}

export function createDevSession({
  document,
  catalog,
  offerIds,
  overrideUrl,
}: {
  document: AtlasDevOverrideDocument;
  catalog: AtlasHostCatalog;
  offerIds: AtlasDevelopmentOfferIds;
  overrideUrl: string;
}): AtlasDevSessionDocument {
  return {
    schemaVersion: '1',
    hostId: document.hostId,
    catalog,
    overrides: document.overrides,
    ...(document.hostOverride ? { hostOverride: document.hostOverride } : {}),
    offerIds,
    overrideUrl,
    generatedAt: document.generatedAt,
  };
}

function dedupeManifests(overrides: AtlasRuntimeOverride[]): AtlasManifest[] {
  const manifests = overrides.map((override) => override.manifest);

  return [
    ...new Map(manifests.map((manifest) => [manifest.id, manifest])).values(),
  ];
}

function createLocalHostPlaceholder({
  hostId,
  createdAt,
}: {
  hostId: string;
  createdAt: string;
}): AtlasHostManifest {
  return {
    schemaVersion: '1',
    kind: 'host',
    id: hostId,
    name: hostId,
    version: '0.0.0-local',
    buildId: 'local-placeholder',
    channel: 'local',
    framework: 'react',
    remoteEntryUrl: `http://localhost:${LOCAL_HOST_PLACEHOLDER_PORT}/remoteEntry.json`,
    exposes: { entry: './host' },
    requiredLoaderApiVersion: '^1.0.0',
    createdAt,
  };
}
