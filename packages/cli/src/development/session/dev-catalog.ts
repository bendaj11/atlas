import type { AtlasRuntimeOverrideDocument } from '@atlas/runtime';
import type { AtlasHostCatalog, AtlasHostManifest } from '@atlas/schema';
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
    localHostPlaceholder({
      hostId: document.hostId,
      createdAt: document.generatedAt,
    });

  return {
    schemaVersion: '1',
    hostId: document.hostId,
    revision: `local:${document.generatedAt}`,
    generatedAt: document.generatedAt,
    host,
    apps: uniqueManifests(document.overrides),
  };
}

export function createDevSession(
  document: AtlasDevOverrideDocument,
  catalog: AtlasHostCatalog,
  overrideUrl: string,
): AtlasDevSessionDocument {
  return {
    schemaVersion: '1',
    hostId: document.hostId,
    catalog,
    overrides: document.overrides,
    ...(document.hostOverride ? { hostOverride: document.hostOverride } : {}),
    overrideUrl,
    generatedAt: document.generatedAt,
  };
}

export function mergeLocalCatalog({
  productionCatalog,
  localCatalog,
}: {
  productionCatalog: AtlasHostCatalog;
  localCatalog: AtlasHostCatalog;
}): AtlasHostCatalog {
  const localApps = new Map(localCatalog.apps.map((app) => [app.id, app]));
  const productionApps = productionCatalog.apps.map(
    (app) => localApps.get(app.id) ?? app,
  );
  const additionalLocalApps = localCatalog.apps.filter(
    (app) => !productionCatalog.apps.some(({ id }) => id === app.id),
  );

  return {
    ...productionCatalog,
    revision: localCatalog.revision,
    generatedAt: localCatalog.generatedAt,
    host:
      localCatalog.host.channel === 'local'
        ? localCatalog.host
        : productionCatalog.host,
    apps: [...productionApps, ...additionalLocalApps],
  };
}

function uniqueManifests(
  overrides: AtlasRuntimeOverrideDocument['overrides'],
): AtlasHostCatalog['apps'] {
  const manifests = overrides.map((override) => override.manifest);

  return [
    ...new Map(manifests.map((manifest) => [manifest.id, manifest])).values(),
  ];
}

function localHostPlaceholder({
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
