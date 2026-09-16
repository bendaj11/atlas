import type {
  AtlasHostCatalog,
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
  AtlasManifestDescriptor,
  AtlasStaticRegistry,
} from '@atlas/schema';
import { bootstrapError } from '../../shared/errors/bootstrap-error.js';
import { requestDevelopmentSession } from '../development-session/development-session.js';
import { fetchJson } from '../fetch-json/fetch-json.js';
import { loadPublishedArtifact } from '../published-artifact/published-artifact.js';

export const OVERRIDES_STORAGE_KEY = 'atlas.runtime-overrides';

export interface RuntimeAppOverride {
  appId?: string;
  manifest?: AtlasManifest;
}

export interface RuntimeOverrides {
  hostId?: string;
  /** @deprecated */
  host?: { manifest?: AtlasHostManifest };
  hostOverride?: AtlasHostManifest;
  /** @deprecated */
  apps?: RuntimeAppOverride[];
  overrides?: RuntimeAppOverride[];
}

export interface DevSession {
  schemaVersion?: string;
  hostId?: string;
  generatedAt?: string;
  catalog?: AtlasHostCatalog;
  hostOverride?: AtlasHostManifest;
  overrides?: RuntimeAppOverride[];
}

export interface OverridesDependencies {
  readonly sessionStorage: Pick<Storage, 'getItem' | 'setItem'>;
  readonly localStorage: Pick<Storage, 'getItem'>;
  readonly fetchJson: typeof fetchJson;
  readonly requestDevelopmentSession: typeof requestDevelopmentSession;
  readonly loadPublishedArtifact: typeof loadPublishedArtifact;
}

export interface ApplyOverridesOptions {
  runtime: AtlasHostRuntimeConfig;
  catalog: AtlasHostCatalog;
  developmentSession?: DevSession;
  dependencies?: OverridesDependencies;
}

interface OverridesContext {
  runtime: AtlasHostRuntimeConfig;
  dependencies: OverridesDependencies;
}

export async function applyOverrides({
  runtime,
  catalog,
  developmentSession,
  dependencies = defaultDependencies(),
}: ApplyOverridesOptions): Promise<AtlasHostCatalog> {
  const context = { runtime, dependencies };
  const devSession =
    developmentSession ?? (await discoverDevelopmentSession(context));
  const stored = devSession
    ? storeDevelopmentSession({ devSession, dependencies })
    : storedOverridesDocument(dependencies);
  const baseCatalog = devSession
    ? mergeDevSessionCatalog({ catalog, session: devSession })
    : catalog;

  if (!stored) return baseCatalog;

  const overrides = JSON.parse(stored) as RuntimeOverrides;
  if (overrides.hostId !== runtime.hostId) return baseCatalog;

  return applyOverridesDocument({
    ...context,
    catalog: baseCatalog,
    overrides,
  });
}

async function discoverDevelopmentSession({
  runtime,
  dependencies,
}: OverridesContext): Promise<DevSession | undefined> {
  if (runtime.developmentSessionUrl)
    return dependencies.fetchJson<DevSession>({
      url: runtime.developmentSessionUrl,
      runtime,
    });

  return (await dependencies.requestDevelopmentSession({
    hostId: runtime.hostId,
  })) as DevSession | undefined;
}

function storeDevelopmentSession({
  devSession,
  dependencies,
}: {
  devSession: DevSession;
  dependencies: OverridesDependencies;
}): string {
  const stored = JSON.stringify(devSession);
  dependencies.sessionStorage.setItem(OVERRIDES_STORAGE_KEY, stored);

  return stored;
}

function storedOverridesDocument(
  dependencies: OverridesDependencies,
): string | null {
  return (
    dependencies.sessionStorage.getItem(OVERRIDES_STORAGE_KEY) ||
    dependencies.localStorage.getItem(OVERRIDES_STORAGE_KEY)
  );
}

async function applyOverridesDocument({
  runtime,
  dependencies,
  catalog,
  overrides,
}: OverridesContext & {
  catalog: AtlasHostCatalog;
  overrides: RuntimeOverrides;
}): Promise<AtlasHostCatalog> {
  const context = { runtime, dependencies };
  const selectedHost =
    overrides.host?.manifest || overrides.hostOverride || catalog.host;
  const host =
    (await resolveOverrideManifest({ ...context, manifest: selectedHost })) ||
    catalog.host;

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
    const manifest = await resolveOverrideManifest({
      ...context,
      manifest: assertAppOverride(override),
    });
    if (!manifest) continue;

    if (appsById.has(manifest.id)) appsById.set(manifest.id, manifest);
    else if (externalDependencyIds.has(manifest.id))
      providersById.set(manifest.id, manifest);
    else if (manifest.channel === 'local') appsById.set(manifest.id, manifest);
    else
      throw overrideError(
        `Atlas app override "${manifest.id}" (${manifest.channel}) targets neither a catalog app nor an external widget provider of host "${runtime.hostId}".`,
      );
  }

  return {
    ...catalog,
    host,
    apps: [...appsById.values()],
    widgetProviders: [...providersById.values()],
  };
}

function assertAppOverride(override: RuntimeAppOverride): AtlasManifest {
  if (!override.manifest)
    throw overrideError(
      `Atlas app override for "${override.appId}" has no manifest.`,
    );
  if (override.manifest.kind !== 'app')
    throw overrideError(
      `Atlas app override for "${override.appId ?? override.manifest.id}" carries a ${override.manifest.kind} manifest instead of an app manifest.`,
    );
  if (override.manifest.id !== (override.appId || override.manifest.id))
    throw overrideError(
      `Atlas app override for "${override.appId}" carries a manifest for app "${override.manifest.id}".`,
    );

  return override.manifest;
}

function defaultDependencies(): OverridesDependencies {
  return {
    sessionStorage,
    localStorage,
    fetchJson,
    requestDevelopmentSession,
    loadPublishedArtifact,
  };
}

function overrideError(message: string) {
  return bootstrapError({ code: 'OVERRIDE_INVALID', message });
}

function mergeDevSessionCatalog({
  catalog,
  session,
}: {
  catalog: AtlasHostCatalog;
  session: DevSession;
}): AtlasHostCatalog {
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

async function resolveOverrideManifest<
  TManifest extends AtlasHostManifest | AtlasManifest,
>({
  manifest,
  runtime,
  dependencies,
}: OverridesContext & { manifest: TManifest }): Promise<TManifest | undefined> {
  if (manifest.channel === 'local') return manifest;
  const registryRoot = artifactRegistryRoot(manifest);
  if (!registryRoot) return manifest;

  const descriptor = await registryDescriptor({
    manifest,
    registryRoot,
    runtime,
    dependencies,
  });
  if (!descriptor) return manifest;

  const loaded = await dependencies.loadPublishedArtifact({
    reference: descriptorReference({ registryRoot, descriptor }),
    runtime,
  });

  return loaded.kind === manifest.kind ? (loaded as TManifest) : manifest;
}

async function registryDescriptor({
  manifest,
  registryRoot,
  runtime,
  dependencies,
}: OverridesContext & {
  manifest: AtlasHostManifest | AtlasManifest;
  registryRoot: string;
}): Promise<AtlasManifestDescriptor | undefined> {
  let registry: AtlasStaticRegistry;
  try {
    registry = await dependencies.fetchJson<AtlasStaticRegistry>({
      url: `${registryRoot}/registry.json`,
      runtime,
    });
  } catch {
    return undefined;
  }
  const artifact =
    manifest.kind === 'host'
      ? registry.hosts[manifest.id]
      : registry.apps[manifest.id];

  return manifest.prNumber
    ? artifact?.previews[String(manifest.prNumber)]
    : artifact?.releases[manifest.version];
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

function descriptorReference({
  registryRoot,
  descriptor,
}: {
  registryRoot: string;
  descriptor: AtlasManifestDescriptor;
}): AtlasManifestDescriptor & { url: string } {
  return {
    ...descriptor,
    url: new URL(descriptor.path, `${registryRoot}/`).href,
  };
}
