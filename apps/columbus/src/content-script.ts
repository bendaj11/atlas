type AtlasReleaseChannel = "production" | "pr" | "local";

interface AtlasInterceptManifest {
  schemaVersion: "1";
  kind: "host" | "app";
  id: string;
  name: string;
  version: string;
  buildId: string;
  channel: AtlasReleaseChannel;
  framework: "angular" | "react" | "vue";
  remoteEntryUrl: string;
  requiredHostSdkVersion: string;
  supportedHosts: string[];
  placements: Array<{ hostId: string }>;
}

interface AtlasInterceptCatalog {
  schemaVersion: "1";
  hostId: string;
  generatedAt: string;
  revision: string;
  host: AtlasInterceptManifest;
  apps: AtlasInterceptManifest[];
}

interface AtlasInterceptDevSession {
  schemaVersion: "1";
  hostId: string;
  catalog: AtlasInterceptCatalog;
  overrides: Array<{ appId: string; manifest: AtlasInterceptManifest }>;
  hostOverride?: AtlasInterceptManifest;
  generatedAt: string;
}

const ATLAS_DEV_SESSION_URL = "http://localhost:4400/atlas.dev-session.json";
const ATLAS_CATALOG_PATH = /\/hosts\/([^/]+)\/catalog\.json$/;
const ATLAS_RUNTIME_CONFIG_PATH = /\/atlas\.runtime\.json$/;
const DISABLED_LOCAL_APPS_KEY_PREFIX = "atlas.disabled-local-apps.";
const atlasWindow = window as Window & { __atlasExtensionInterceptorInstalled?: boolean };

if (!atlasWindow.__atlasExtensionInterceptorInstalled) {
  atlasWindow.__atlasExtensionInterceptorInstalled = true;
  installAtlasCatalogInterceptor();
}

function installAtlasCatalogInterceptor(): void {
  const nativeFetch = window.fetch.bind(window);
  const overridePolicies = new Map<string, boolean>();

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const requestUrl = requestHref(input);
    if (isRuntimeConfigRequest(requestUrl)) {
      const response = await nativeFetch(input, init);
      await rememberOverridePolicy(response, overridePolicies);
      return response;
    }

    const hostId = catalogRequestHostId(requestUrl);
    if (!hostId) return nativeFetch(input, init);
    if (overridePolicies.get(hostId) !== true) return nativeFetch(input, init);

    const [catalogResponse, session] = await Promise.all([nativeFetch(input, init), readDevSession(hostId)]);

    if (!session || session.hostId !== hostId) return catalogResponse;
    return catalogResponse.ok
      ? mergeCatalogResponse(catalogResponse, session)
      : localCatalogResponse(session);
  };

  async function readDevSession(hostId: string): Promise<AtlasInterceptDevSession | undefined> {
    return nativeFetch(devSessionUrl(hostId), { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<AtlasInterceptDevSession> : undefined)
      .then((session) => isDevSession(session, hostId) ? session : undefined)
      .catch(() => undefined);
  }
}

async function rememberOverridePolicy(response: Response, policies: Map<string, boolean>): Promise<void> {
  if (!response.ok) return;
  try {
    const config = await response.clone().json() as {
      schemaVersion?: unknown;
      hostId?: unknown;
      allowCustomOverrides?: unknown;
      allowOverrides?: unknown;
    };
    if (config.schemaVersion === "1" && typeof config.hostId === "string") {
      policies.set(config.hostId, config.allowCustomOverrides === true || config.allowOverrides === true);
    }
  } catch {
    return;
  }
}

function isDevSession(value: unknown, hostId: string): value is AtlasInterceptDevSession {
  if (typeof value !== "object" || value === null) return false;
  const session = value as Partial<AtlasInterceptDevSession>;
  return session.schemaVersion === "1"
    && session.hostId === hostId
    && session.catalog?.schemaVersion === "1"
    && session.catalog.hostId === hostId
    && session.catalog.host?.kind === "host"
    && (!session.hostOverride || (session.hostOverride.kind === "host" && session.hostOverride.id === hostId))
    && Array.isArray(session.catalog.apps)
    && Array.isArray(session.overrides)
    && session.overrides.every(isMatchingOverride);
}

function isMatchingOverride(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const override = value as { appId?: unknown; manifest?: { id?: unknown } };
  return typeof override.appId === "string" && override.appId === override.manifest?.id;
}

function devSessionUrl(hostId: string): string {
  const url = new URL(ATLAS_DEV_SESSION_URL);
  url.searchParams.set("hostId", hostId);
  return url.href;
}

async function mergeCatalogResponse(response: Response, session: AtlasInterceptDevSession): Promise<Response> {
  try {
    const catalog = await response.clone().json() as AtlasInterceptCatalog;
    if (catalog.schemaVersion !== "1" || catalog.hostId !== session.hostId) return response;
    return jsonResponse(mergeCatalog(catalog, session), response.status);
  } catch {
    return response;
  }
}

function localCatalogResponse(session: AtlasInterceptDevSession): Response {
  const disabledAppIds = readDisabledAppIds(session.hostId);
  return jsonResponse({
    ...session.catalog,
    apps: session.catalog.apps.filter((manifest) => !disabledAppIds.has(manifest.id))
  });
}

function mergeCatalog(catalog: AtlasInterceptCatalog, session: AtlasInterceptDevSession): AtlasInterceptCatalog {
  const disabledAppIds = readDisabledAppIds(session.hostId);
  const enabledOverrides = session.overrides.filter((override) => !disabledAppIds.has(override.appId));
  const overrides = new Map(enabledOverrides.map((override) => [override.appId, override.manifest]));
  const baseManifests = catalog.apps.filter((manifest) => manifest.channel !== "local" || !disabledAppIds.has(manifest.id));
  const merged = baseManifests.map((manifest) => overrides.get(manifest.id) ?? manifest);
  const present = new Set(merged.map((manifest) => manifest.id));
  for (const override of enabledOverrides) {
    if (!present.has(override.appId)) merged.push(override.manifest);
  }
  return {
    ...catalog,
    generatedAt: session.generatedAt,
    host: session.hostOverride?.kind === "host" ? session.hostOverride : catalog.host,
    apps: merged
  };
}

function readDisabledAppIds(hostId: string): Set<string> {
  try {
    const key = `${DISABLED_LOCAL_APPS_KEY_PREFIX}${hostId}`;
    const tabValue = sessionStorage.getItem(key);
    const stored = tabValue ?? localStorage.getItem(key);
    const appIds = stored ? JSON.parse(stored) as unknown : [];
    return new Set(Array.isArray(appIds) ? appIds.filter((value): value is string => typeof value === "string") : []);
  } catch {
    return new Set();
  }
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(`${JSON.stringify(value, null, 2)}\n`, {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function requestHref(input: RequestInfo | URL): string {
  if (input instanceof Request) return input.url;
  if (input instanceof URL) return input.href;
  return String(input);
}

function catalogRequestHostId(value: string): string | undefined {
  try {
    const match = ATLAS_CATALOG_PATH.exec(new URL(value, location.href).pathname);
    return match?.[1] ? decodeURIComponent(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

function isRuntimeConfigRequest(value: string): boolean {
  try {
    return ATLAS_RUNTIME_CONFIG_PATH.test(new URL(value, location.href).pathname);
  } catch {
    return false;
  }
}
