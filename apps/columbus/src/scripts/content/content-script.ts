type AtlasReleaseChannel = 'production' | 'pr' | 'local';

interface AtlasInterceptManifest {
  schemaVersion: '1';
  kind: 'host' | 'app';
  id: string;
  name: string;
  version: string;
  buildId: string;
  channel: AtlasReleaseChannel;
  framework: 'angular' | 'react' | 'vue';
  remoteEntryUrl: string;
  requiredHostSdkVersion: string;
  supportedHosts: string[];
  placements: Array<{ hostId: string }>;
}

interface AtlasInterceptCatalog {
  schemaVersion: '1';
  hostId: string;
  generatedAt: string;
  revision: string;
  host: AtlasInterceptManifest;
  apps: AtlasInterceptManifest[];
}

interface AtlasInterceptDevSession {
  schemaVersion: '1';
  hostId: string;
  catalog: AtlasInterceptCatalog;
  overrides: Array<{ appId: string; manifest: AtlasInterceptManifest }>;
  hostOverride?: AtlasInterceptManifest;
  generatedAt: string;
}

interface AtlasInterceptOverrideDocument {
  schemaVersion: '1';
  hostId: string;
  overrides: Array<{
    appId: string;
    manifest: AtlasInterceptManifest;
    reason: 'local' | 'pr' | 'historical';
  }>;
  hostOverride?: AtlasInterceptManifest;
  generatedAt: string;
}

const ATLAS_DEV_SESSION_URL = 'http://localhost:4400/atlas.dev-session.json';
const ATLAS_CATALOG_PATH = /\/hosts\/([^/]+)\/catalog\.json$/;
const ATLAS_RUNTIME_CONFIG_PATH = /\/atlas\.runtime\.json$/;
const ATLAS_OVERRIDE_DOCUMENT_KEY = 'atlas.runtime-overrides';
const DISABLED_LOCAL_APPS_KEY_PREFIX = 'atlas.disabled-local-apps.';
const atlasWindow = window as Window & {
  __atlasExtensionInterceptorInstalled?: boolean;
};

if (!atlasWindow.__atlasExtensionInterceptorInstalled) {
  atlasWindow.__atlasExtensionInterceptorInstalled = true;
  installAtlasCatalogInterceptor();
}

function installAtlasCatalogInterceptor(): void {
  const nativeFetch = window.fetch.bind(window);
  const overridePolicies = new Map<string, boolean>();

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const requestUrl = requestHref(input);
    if (isRuntimeConfigRequest(requestUrl)) {
      const response = await nativeFetch(input, init);
      await rememberOverridePolicy(response, overridePolicies);
      return response;
    }

    const hostId = catalogRequestHostId(requestUrl);
    if (!hostId) return nativeFetch(input, init);
    if (overridePolicies.get(hostId) !== true) return nativeFetch(input, init);
    const [catalogResponse, session] = await Promise.all([
      nativeFetch(input, init),
      readDevSession(hostId),
    ]);

    if (!session || session.hostId !== hostId) return catalogResponse;
    try {
      persistDevSessionOverrides(session);
      return catalogResponse.ok
        ? mergeCatalogResponse(catalogResponse, session)
        : localCatalogResponse(session);
    } catch {
      return catalogResponse;
    }
  };

  async function readDevSession(
    hostId: string,
  ): Promise<AtlasInterceptDevSession | undefined> {
    return nativeFetch(devSessionUrl(hostId), { cache: 'no-store' })
      .then((response) =>
        response.ok
          ? (response.json() as Promise<AtlasInterceptDevSession>)
          : undefined,
      )
      .then((session) => (isDevSession(session, hostId) ? session : undefined))
      .catch(() => undefined);
  }
}

function persistDevSessionOverrides(session: AtlasInterceptDevSession): void {
  const disabledAppIds = readDisabledAppIds(session.hostId);
  const storage = overrideStorage();
  const existing = readOverrideDocument(
    storage.getItem(ATLAS_OVERRIDE_DOCUMENT_KEY),
    session.hostId,
  );
  const explicitAppOverrides = new Map(
    (existing?.overrides ?? [])
      .filter((override) => override.manifest.channel !== 'local')
      .map((override) => [override.appId, override]),
  );
  const localOverrides = session.overrides
    .filter((override) => !disabledAppIds.has(override.appId))
    .map((override) => ({ ...override, reason: 'local' as const }));
  const explicitHostOverride =
    existing?.hostOverride?.channel !== 'local'
      ? existing?.hostOverride
      : undefined;
  const documentValue: AtlasInterceptOverrideDocument = {
    schemaVersion: '1',
    hostId: session.hostId,
    generatedAt: session.generatedAt,
    ...(explicitHostOverride
      ? { hostOverride: explicitHostOverride }
      : session.hostOverride
        ? { hostOverride: session.hostOverride }
        : {}),
    overrides: localOverrides.map(
      (override) => explicitAppOverrides.get(override.appId) ?? override,
    ),
  };
  for (const [appId, override] of explicitAppOverrides) {
    if (!documentValue.overrides.some((candidate) => candidate.appId === appId))
      documentValue.overrides.push(override);
  }
  storage.setItem(ATLAS_OVERRIDE_DOCUMENT_KEY, JSON.stringify(documentValue));
}

function overrideStorage(): Storage {
  if (sessionStorage.getItem(ATLAS_OVERRIDE_DOCUMENT_KEY) !== null)
    return sessionStorage;
  if (localStorage.getItem(ATLAS_OVERRIDE_DOCUMENT_KEY) !== null)
    return localStorage;
  return localStorage;
}

async function rememberOverridePolicy(
  response: Response,
  policies: Map<string, boolean>,
): Promise<void> {
  if (!response.ok) return;
  try {
    const config = (await response.clone().json()) as {
      schemaVersion?: unknown;
      hostId?: unknown;
      allowCustomOverrides?: unknown;
    };
    if (config.schemaVersion === '1' && typeof config.hostId === 'string') {
      policies.set(config.hostId, config.allowCustomOverrides === true);
    }
  } catch {
    return;
  }
}

function isDevSession(
  value: unknown,
  hostId: string,
): value is AtlasInterceptDevSession {
  if (typeof value !== 'object' || value === null) return false;
  const session = value as Partial<AtlasInterceptDevSession>;
  return (
    session.schemaVersion === '1' &&
    session.hostId === hostId &&
    session.catalog?.schemaVersion === '1' &&
    session.catalog.hostId === hostId &&
    isManifest(session.catalog.host, 'host', hostId) &&
    Array.isArray(session.catalog.apps) &&
    session.catalog.apps.every((manifest) => isManifest(manifest, 'app')) &&
    Array.isArray(session.overrides) &&
    session.overrides.every(isMatchingOverride) &&
    (session.hostOverride === undefined ||
      isManifest(session.hostOverride, 'host', hostId)) &&
    typeof session.generatedAt === 'string'
  );
}

function isMatchingOverride(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const override = value as { appId?: unknown; manifest?: unknown };
  return (
    typeof override.appId === 'string' &&
    isManifest(override.manifest, 'app', override.appId)
  );
}

function isManifest(
  value: unknown,
  kind?: AtlasInterceptManifest['kind'],
  id?: string,
): value is AtlasInterceptManifest {
  if (typeof value !== 'object' || value === null) return false;
  const manifest = value as Partial<AtlasInterceptManifest>;
  return (
    manifest.schemaVersion === '1' &&
    (manifest.kind === 'host' || manifest.kind === 'app') &&
    (kind === undefined || manifest.kind === kind) &&
    typeof manifest.id === 'string' &&
    (id === undefined || manifest.id === id) &&
    typeof manifest.name === 'string' &&
    typeof manifest.version === 'string' &&
    typeof manifest.buildId === 'string' &&
    (manifest.channel === 'production' ||
      manifest.channel === 'pr' ||
      manifest.channel === 'local') &&
    (manifest.framework === 'angular' ||
      manifest.framework === 'react' ||
      manifest.framework === 'vue') &&
    typeof manifest.remoteEntryUrl === 'string' &&
    Array.isArray(manifest.supportedHosts) &&
    Array.isArray(manifest.placements)
  );
}

function readOverrideDocument(
  stored: string | null,
  hostId: string,
): AtlasInterceptOverrideDocument | undefined {
  if (!stored) return undefined;
  try {
    const value: unknown = JSON.parse(stored);
    if (typeof value !== 'object' || value === null) return undefined;
    const documentValue = value as Partial<AtlasInterceptOverrideDocument>;
    if (
      documentValue.schemaVersion !== '1' ||
      documentValue.hostId !== hostId ||
      typeof documentValue.generatedAt !== 'string' ||
      !Array.isArray(documentValue.overrides) ||
      !documentValue.overrides.every(isStoredOverride) ||
      (documentValue.hostOverride !== undefined &&
        !isManifest(documentValue.hostOverride, 'host', hostId))
    )
      return undefined;
    return documentValue as AtlasInterceptOverrideDocument;
  } catch {
    return undefined;
  }
}

function isStoredOverride(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const override = value as {
    appId?: unknown;
    manifest?: unknown;
    reason?: unknown;
  };
  return (
    typeof override.appId === 'string' &&
    isManifest(override.manifest, 'app', override.appId) &&
    (override.reason === 'local' ||
      override.reason === 'pr' ||
      override.reason === 'historical')
  );
}

function devSessionUrl(hostId: string): string {
  const url = new URL(ATLAS_DEV_SESSION_URL);
  url.searchParams.set('hostId', hostId);
  return url.href;
}

async function mergeCatalogResponse(
  response: Response,
  session: AtlasInterceptDevSession,
): Promise<Response> {
  try {
    const catalog = (await response.clone().json()) as AtlasInterceptCatalog;
    if (catalog.schemaVersion !== '1' || catalog.hostId !== session.hostId)
      return response;
    return jsonResponse(mergeCatalog(catalog, session), response.status);
  } catch {
    return response;
  }
}

function localCatalogResponse(session: AtlasInterceptDevSession): Response {
  const disabledAppIds = readDisabledAppIds(session.hostId);
  return jsonResponse({
    ...session.catalog,
    apps: session.catalog.apps.filter(
      (manifest) => !disabledAppIds.has(manifest.id),
    ),
  });
}

function mergeCatalog(
  catalog: AtlasInterceptCatalog,
  session: AtlasInterceptDevSession,
): AtlasInterceptCatalog {
  const disabledAppIds = readDisabledAppIds(session.hostId);
  const enabledOverrides = session.overrides.filter(
    (override) => !disabledAppIds.has(override.appId),
  );
  const overrides = new Map(
    enabledOverrides.map((override) => [override.appId, override.manifest]),
  );
  const baseManifests = catalog.apps.filter(
    (manifest) =>
      manifest.channel !== 'local' || !disabledAppIds.has(manifest.id),
  );
  const merged = baseManifests.map(
    (manifest) => overrides.get(manifest.id) ?? manifest,
  );
  const present = new Set(merged.map((manifest) => manifest.id));
  for (const override of enabledOverrides) {
    if (!present.has(override.appId)) merged.push(override.manifest);
  }
  return {
    ...catalog,
    generatedAt: session.generatedAt,
    host:
      session.hostOverride?.kind === 'host'
        ? session.hostOverride
        : catalog.host,
    apps: merged,
  };
}

function readDisabledAppIds(hostId: string): Set<string> {
  try {
    const key = `${DISABLED_LOCAL_APPS_KEY_PREFIX}${hostId}`;
    const tabValue = sessionStorage.getItem(key);
    const stored = tabValue ?? localStorage.getItem(key);
    const appIds = stored ? (JSON.parse(stored) as unknown) : [];
    return new Set(
      Array.isArray(appIds)
        ? appIds.filter((value): value is string => typeof value === 'string')
        : [],
    );
  } catch {
    return new Set();
  }
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(`${JSON.stringify(value, null, 2)}\n`, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function requestHref(input: RequestInfo | URL): string {
  if (input instanceof Request) return input.url;
  if (input instanceof URL) return input.href;
  return String(input);
}

function catalogRequestHostId(value: string): string | undefined {
  try {
    const match = ATLAS_CATALOG_PATH.exec(
      new URL(value, location.href).pathname,
    );
    return match?.[1] ? decodeURIComponent(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

function isRuntimeConfigRequest(value: string): boolean {
  try {
    return ATLAS_RUNTIME_CONFIG_PATH.test(
      new URL(value, location.href).pathname,
    );
  } catch {
    return false;
  }
}
