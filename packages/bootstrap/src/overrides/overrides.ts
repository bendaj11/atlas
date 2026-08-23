import type {
  AtlasHostCatalog,
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
  AtlasManifestDescriptor,
  AtlasStaticRegistry,
} from '@atlas/schema';
import {
  DEV_SESSION_PORT_PARAM,
  DEV_SESSION_URL,
  DOCUMENT_KEY,
} from '../constants.js';
import { fetchJson } from '../fetch-json/fetch-json.js';
import type { DevSession, RuntimeOverrides } from '../types.js';
import { loadPublishedArtifact } from '../published-artifact/published-artifact.js';

export async function applyOverrides(
  runtime: AtlasHostRuntimeConfig,
  catalog: AtlasHostCatalog,
): Promise<AtlasHostCatalog> {
  let stored: string | null;
  if (hasDevSessionPort(location.search)) {
    const devSession = await fetchDevSession(runtime.hostId);
    catalog = mergeDevSessionCatalog(catalog, devSession);
    stored = JSON.stringify(devSession);
    sessionStorage.setItem(DOCUMENT_KEY, stored);
    removeDevSessionPortFromAddressBar();
  } else {
    stored =
      sessionStorage.getItem(DOCUMENT_KEY) ||
      localStorage.getItem(DOCUMENT_KEY);
  }

  if (!stored) return catalog;

  const overrides = JSON.parse(stored) as RuntimeOverrides;
  if (overrides.hostId !== runtime.hostId) return catalog;

  const selectedHost =
    overrides.host?.manifest || overrides.hostOverride || catalog.host;
  const host =
    (await resolveOverrideManifest(selectedHost, runtime)) || catalog.host;

  const appsById = new Map(
    catalog.apps.map((manifest) => [manifest.id, manifest]),
  );
  const providersById = new Map(
    (catalog.widgetProviders || []).map((manifest) => [manifest.id, manifest]),
  );
  const externalDependencyIds = new Set(
    catalog.apps.flatMap((manifest) => manifest.externalAppsDependencies || []),
  );

  for (const override of overrides.apps || overrides.overrides || []) {
    if (
      !override.manifest ||
      override.manifest.kind !== 'app' ||
      override.manifest.id !== (override.appId || override.manifest.id)
    ) {
      throw new Error('Atlas app override is invalid.');
    }

    const manifest = await resolveOverrideManifest(override.manifest, runtime);
    if (!manifest) continue;

    if (appsById.has(manifest.id)) appsById.set(manifest.id, manifest);
    else if (externalDependencyIds.has(manifest.id))
      providersById.set(manifest.id, manifest);
    else
      throw new Error(
        'Atlas app override does not target a selected app or external widget provider.',
      );
  }

  return {
    ...catalog,
    host,
    apps: [...appsById.values()],
    widgetProviders: [...providersById.values()],
  };
}

function mergeDevSessionCatalog(
  catalog: AtlasHostCatalog,
  session: DevSession,
): AtlasHostCatalog {
  const overrides = new Map(
    (session.overrides || []).map((override) => [
      override.appId,
      override.manifest,
    ]),
  );

  const apps = catalog.apps.map(
    (manifest) => overrides.get(manifest.id) || manifest,
  );
  const present = new Set(apps.map((manifest) => manifest.id));

  for (const override of session.overrides || []) {
    if (override.appId && override.manifest && !present.has(override.appId))
      apps.push(override.manifest);
  }

  return {
    ...catalog,
    ...(session.generatedAt ? { generatedAt: session.generatedAt } : {}),
    host: session.hostOverride || catalog.host,
    apps,
  };
}

function hasDevSessionPort(search: string): boolean {
  return new URLSearchParams(search).has(DEV_SESSION_PORT_PARAM);
}

async function fetchDevSession(hostId: string): Promise<DevSession> {
  const url = new URL(DEV_SESSION_URL);
  const requestedPort = new URLSearchParams(location.search).get(
    DEV_SESSION_PORT_PARAM,
  );
  if (!isValidPort(requestedPort))
    throw new Error('Atlas development session port must be a valid TCP port.');

  url.port = requestedPort;
  url.searchParams.set('hostId', hostId);
  return fetchJson<DevSession>(url.href);
}

function isValidPort(value: string | null): value is string {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65_535;
}

function removeDevSessionPortFromAddressBar(): void {
  const url = new URL(location.href);
  url.searchParams.delete(DEV_SESSION_PORT_PARAM);
  history.replaceState(history.state, '', url.href);
}

async function resolveOverrideManifest<
  TManifest extends AtlasHostManifest | AtlasManifest,
>(
  manifest: TManifest,
  runtime: AtlasHostRuntimeConfig,
): Promise<TManifest | undefined> {
  if (manifest.channel === 'local') return manifest;
  const registryRoot = artifactRegistryRoot(manifest);
  if (!registryRoot) return manifest;

  try {
    const registry = await fetchJson<AtlasStaticRegistry>(
      `${registryRoot}/registry.json`,
      runtime,
    );
    const artifact =
      manifest.kind === 'host'
        ? registry.hosts[manifest.id]
        : registry.apps[manifest.id];
    const descriptor = manifest.prNumber
      ? artifact?.previews[String(manifest.prNumber)]
      : artifact?.releases[manifest.version];
    if (!descriptor) return manifest;
    const loaded = await loadPublishedArtifact(
      descriptorReference(registryRoot, descriptor),
      runtime,
    );
    return loaded.kind === manifest.kind ? (loaded as TManifest) : manifest;
  } catch {
    return manifest;
  }
}

function artifactRegistryRoot(
  manifest: AtlasHostManifest | AtlasManifest,
): string | undefined {
  const collection = manifest.kind === 'host' ? 'hosts' : 'apps';
  const marker = '/' + collection + '/' + manifest.id + '/';
  const url = new URL(manifest.remoteEntryUrl);
  const markerIndex = url.pathname.indexOf(marker);

  if (markerIndex < 0) return undefined;
  url.pathname = url.pathname.slice(0, markerIndex);
  url.search = '';
  url.hash = '';
  return url.href.replace(/\/$/, '');
}

function descriptorReference(
  registryRoot: string,
  descriptor: AtlasManifestDescriptor,
): AtlasManifestDescriptor & { url: string } {
  return {
    ...descriptor,
    url: new URL(descriptor.path, `${registryRoot}/`).href,
  };
}
