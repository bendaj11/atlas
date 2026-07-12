type AtlasReleaseChannel = "production" | "pr" | "historical" | "local";

interface AtlasInterceptManifest {
  schemaVersion: "1";
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
  manifests: AtlasInterceptManifest[];
}

interface AtlasInterceptDevSession {
  schemaVersion: "1";
  hostId: string;
  catalog: AtlasInterceptCatalog;
  overrides: Array<{ appId: string; manifest: AtlasInterceptManifest }>;
  generatedAt: string;
}

const ATLAS_DEV_SESSION_URL = "http://127.0.0.1:4400/atlas.dev-session.json";
const ATLAS_CATALOG_PATH = /\/hosts\/([^/]+)\/catalog\.json$/;
const ATLAS_RUNTIME_OVERRIDE_KEYS = ["atlas.runtime-overrides", "atlas.runtime-override-url"];
const atlasWindow = window as Window & { __atlasExtensionInterceptorInstalled?: boolean };

if (!atlasWindow.__atlasExtensionInterceptorInstalled) {
  atlasWindow.__atlasExtensionInterceptorInstalled = true;
  installAtlasCatalogInterceptor();
}

function installAtlasCatalogInterceptor(): void {
  const nativeFetch = window.fetch.bind(window);
  const devSessions = new Map<string, Promise<AtlasInterceptDevSession | undefined>>();

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const requestUrl = requestHref(input);
    const hostId = catalogRequestHostId(requestUrl);
    if (!hostId) return nativeFetch(input, init);

    const [catalogResponse, session] = await Promise.all([nativeFetch(input, init), readDevSession(hostId)]);

    if (!session || session.hostId !== hostId) return catalogResponse;
    return catalogResponse.ok
      ? mergeCatalogResponse(catalogResponse, session)
      : localCatalogResponse(session);
  };

  async function readDevSession(hostId: string): Promise<AtlasInterceptDevSession | undefined> {
    const pendingSession = devSessions.get(hostId) ?? nativeFetch(devSessionUrl(hostId), { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<AtlasInterceptDevSession> : undefined)
      .then((session) => session?.schemaVersion === "1" ? session : undefined)
      .catch(() => undefined);
    devSessions.set(hostId, pendingSession);
    const session = await pendingSession;
    if (session) clearRuntimeStorageOverrides();
    else devSessions.delete(hostId);
    return session;
  }
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
  return jsonResponse(session.catalog);
}

function mergeCatalog(catalog: AtlasInterceptCatalog, session: AtlasInterceptDevSession): AtlasInterceptCatalog {
  const overrides = new Map(session.overrides.map((override) => [override.appId, override.manifest]));
  const merged = catalog.manifests.map((manifest) => overrides.get(manifest.id) ?? manifest);
  const present = new Set(merged.map((manifest) => manifest.id));
  for (const override of session.overrides) {
    if (!present.has(override.appId)) merged.push(override.manifest);
  }
  return {
    ...catalog,
    generatedAt: session.generatedAt,
    manifests: merged
  };
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

function clearRuntimeStorageOverrides(): void {
  for (const key of ATLAS_RUNTIME_OVERRIDE_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}
