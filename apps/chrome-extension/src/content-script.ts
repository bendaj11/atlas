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
  overrides: Array<{ mfId: string; manifest: AtlasInterceptManifest }>;
  generatedAt: string;
}

const ATLAS_DEV_SESSION_URL = "http://localhost:4400/atlas.dev-session.json";
const ATLAS_CATALOG_PATH = /\/hosts\/([^/]+)\/catalog\.json$/;
const atlasWindow = window as Window & { __atlasExtensionInterceptorInstalled?: boolean };

if (!atlasWindow.__atlasExtensionInterceptorInstalled) {
  atlasWindow.__atlasExtensionInterceptorInstalled = true;
  installAtlasCatalogInterceptor();
}

function installAtlasCatalogInterceptor(): void {
  const nativeFetch = window.fetch.bind(window);
  let devSession: Promise<AtlasInterceptDevSession | undefined> | undefined;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const requestUrl = requestHref(input);
    if (!isAtlasCatalogRequest(requestUrl)) return nativeFetch(input, init);

    const [catalogResponse, session] = await Promise.all([
      nativeFetch(input, init),
      readDevSession()
    ]);

    if (!session) return catalogResponse;
    return catalogResponse.ok
      ? mergeCatalogResponse(catalogResponse, session)
      : localCatalogResponse(session);
  };

  function readDevSession(): Promise<AtlasInterceptDevSession | undefined> {
    devSession ??= nativeFetch(ATLAS_DEV_SESSION_URL, { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<AtlasInterceptDevSession> : undefined)
      .then((session) => session?.schemaVersion === "1" ? session : undefined)
      .catch(() => undefined);
    return devSession;
  }
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
  const overrides = new Map(session.overrides.map((override) => [override.mfId, override.manifest]));
  const merged = catalog.manifests.map((manifest) => overrides.get(manifest.id) ?? manifest);
  const present = new Set(merged.map((manifest) => manifest.id));
  for (const override of session.overrides) {
    if (!present.has(override.mfId)) merged.push(override.manifest);
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

function isAtlasCatalogRequest(value: string): boolean {
  try {
    return ATLAS_CATALOG_PATH.test(new URL(value, location.href).pathname);
  } catch {
    return false;
  }
}
