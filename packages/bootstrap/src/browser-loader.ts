export const ATLAS_BROWSER_LOADER = String.raw`
const DOCUMENT_KEY = "atlas.runtime-overrides";
const URL_KEY = "atlas.runtime-override-url";
const DEV_SESSION_URL = "http://localhost:4400/atlas.dev-session.json";
const DEV_SESSION_TIMEOUT_MS = 500;
const LOADER_API_VERSION = "1.0.0";

start().catch(showFatalError);

async function start() {
  const runtime = await fetchJson("/atlas.runtime.json");
  const catalog = await fetchJson(runtime.catalogUrl, runtime);
  const effectiveCatalog = await applyOverrides(runtime, catalog);
  validateCatalog(runtime, effectiveCatalog);
  const root = document.getElementById("atlas-host-root");
  if (!root) throw new Error("Atlas host root is missing.");
  const module = await loadHostModule(effectiveCatalog.host, runtime);
  const entry = module.default && typeof module.default.mount === "function" ? module.default : module;
  if (typeof entry.mount !== "function") throw new Error("Selected host client does not export mount(request).");
  root.replaceChildren();
  await entry.mount({ container: root, runtimeConfig: runtime, catalog: effectiveCatalog });
}

async function loadHostModule(manifest, runtime) {
  validateHostManifest(manifest, runtime);
  const metadata = await fetchJson(manifest.remoteEntryUrl, runtime, manifest.integrity);
  const expose = metadata.exposes && metadata.exposes.find((candidate) => candidate.key === manifest.exposes.entry);
  if (!expose || typeof expose.outFileName !== "string") throw new Error("Selected host remote does not expose " + manifest.exposes.entry + ".");
  const moduleUrl = new URL(expose.outFileName, manifest.remoteEntryUrl);
  validateArtifactUrl(moduleUrl, manifest, runtime);
  return import(moduleUrl.href);
}

async function fetchJson(url, runtime = {}, integrity) {
  const retries = runtime.resourcesRetryCount ?? 3;
  const timeout = runtime.resourcesTimeoutMs ?? 15000;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { cache: "no-cache", signal: AbortSignal.timeout(timeout) });
      if (!response.ok) throw new Error(url + " returned HTTP " + response.status + ".");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (integrity) await validateIntegrity(bytes, integrity);
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function applyOverrides(runtime, catalog) {
  const allowCustom = runtime.allowCustomOverrides === true;
  const overrideUrl = allowCustom ? new URLSearchParams(location.search).get("atlas-override") : undefined;
  let stored = overrideUrl
    ? JSON.stringify(await fetchJson(overrideUrl, runtime))
    : sessionStorage.getItem(DOCUMENT_KEY) || localStorage.getItem(DOCUMENT_KEY);
  if (!stored && allowCustom) {
    const devSession = await discoverDevSession(runtime.hostId);
    if (devSession) {
      catalog = mergeDevSessionCatalog(catalog, devSession);
      stored = JSON.stringify(devSession);
    }
  }
  if (!stored) return catalog;
  const overrides = JSON.parse(stored);
  if (overrides.hostId !== runtime.hostId) return catalog;
  const selectedHost = overrides.host && overrides.host.manifest
    ? overrides.host.manifest
    : overrides.hostOverride || catalog.host;
  const host = await resolveOverrideManifest(selectedHost, runtime) || catalog.host;
  const appsById = new Map(catalog.apps.map((manifest) => [manifest.id, manifest]));
  const providersById = new Map((catalog.widgetProviders || []).map((manifest) => [manifest.id, manifest]));
  const externalDependencyIds = new Set(catalog.apps.flatMap((manifest) => manifest.externalAppsDependencies || []));
  for (const override of overrides.apps || overrides.overrides || []) {
    if (!override.manifest || override.manifest.kind !== "app" || override.manifest.id !== (override.appId || override.manifest.id)) {
      throw new Error("Atlas app override is invalid.");
    }
    const manifest = await resolveOverrideManifest(override.manifest, runtime);
    if (!manifest) continue;
    if (appsById.has(manifest.id)) appsById.set(manifest.id, manifest);
    else if (externalDependencyIds.has(manifest.id)) providersById.set(manifest.id, manifest);
    else throw new Error("Atlas app override does not target a selected app or external widget provider.");
  }
  return { ...catalog, host, apps: [...appsById.values()], widgetProviders: [...providersById.values()] };
}

function mergeDevSessionCatalog(catalog, session) {
  const overrides = new Map((session.overrides || []).map((override) => [override.appId, override.manifest]));
  const apps = catalog.apps.map((manifest) => overrides.get(manifest.id) || manifest);
  const present = new Set(apps.map((manifest) => manifest.id));
  for (const override of session.overrides || []) {
    if (!present.has(override.appId)) apps.push(override.manifest);
  }
  return {
    ...catalog,
    generatedAt: session.generatedAt,
    host: session.hostOverride || catalog.host,
    apps
  };
}

async function discoverDevSession(hostId) {
  try {
    const url = new URL(DEV_SESSION_URL);
    url.searchParams.set("hostId", hostId);
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(DEV_SESSION_TIMEOUT_MS) });
    if (!response.ok) return undefined;
    const session = await response.json();
    return session && session.schemaVersion === "1" && session.hostId === hostId ? session : undefined;
  } catch {
    return undefined;
  }
}

async function resolveOverrideManifest(manifest, runtime) {
  const allowCustom = runtime.allowCustomOverrides === true;
  if (manifest.channel === "local") return allowCustom ? manifest : undefined;
  if (manifest.channel !== "pr" || !manifest.prNumber) return manifest;
  const indexUrl = artifactIndexUrl(manifest);
  if (!indexUrl) return manifest;
  try {
    const index = await fetchJson(indexUrl, runtime);
    if (!Array.isArray(index.manifests)) return manifest;
    return index.manifests.find((candidate) => candidate.prNumber === manifest.prNumber);
  } catch {
    return manifest;
  }
}

function artifactIndexUrl(manifest) {
  const collection = manifest.kind === "host" ? "hosts" : "apps";
  const marker = "/" + collection + "/" + manifest.id + "/";
  const url = new URL(manifest.remoteEntryUrl);
  const markerIndex = url.pathname.indexOf(marker);
  if (markerIndex < 0) return undefined;
  url.pathname = url.pathname.slice(0, markerIndex) + marker + "index.json";
  url.search = "";
  url.hash = "";
  return url.href;
}

function validateCatalog(runtime, catalog) {
  if (!catalog || catalog.schemaVersion !== "1" || catalog.hostId !== runtime.hostId) throw new Error("Atlas catalog does not match runtime host.");
  if (!catalog.host || catalog.host.kind !== "host" || catalog.host.id !== runtime.hostId) throw new Error("Atlas catalog has no matching host client.");
  if (!Array.isArray(catalog.apps) || catalog.apps.some((manifest) => manifest.kind !== "app")) throw new Error("Atlas catalog apps are invalid.");
  if (catalog.widgetProviders && (!Array.isArray(catalog.widgetProviders) || catalog.widgetProviders.some((manifest) => manifest.kind !== "app"))) throw new Error("Atlas catalog widget providers are invalid.");
  validateHostManifest(catalog.host, runtime);
}

function validateHostManifest(manifest, runtime) {
  if (!manifest || manifest.kind !== "host" || manifest.id !== runtime.hostId) throw new Error("Selected host manifest does not match this server.");
  if (!manifest.exposes || typeof manifest.exposes.entry !== "string") throw new Error("Selected host manifest has no entry expose.");
  const requiredMajor = Number(String(manifest.requiredLoaderApiVersion || "").match(/\d+/)?.[0]);
  if (requiredMajor !== Number(LOADER_API_VERSION.split(".")[0])) throw new Error("Selected host client requires an incompatible Atlas loader API.");
  validateArtifactUrl(new URL(manifest.remoteEntryUrl), manifest, runtime);
}

function validateArtifactUrl(url, manifest, runtime) {
  const loopbackHosts = ["localhost", "127.0.0.1", "::1"];
  if (manifest.channel === "local") {
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Local host URL must use HTTP(S).");
    if (!loopbackHosts.includes(url.hostname)) throw new Error("Local host URL must use loopback.");
    return;
  }
  const catalogUrl = new URL(runtime.catalogUrl, location.href);
  if (url.protocol === "http:" && loopbackHosts.includes(url.hostname) && loopbackHosts.includes(catalogUrl.hostname)) return;
  if (url.protocol !== "https:") throw new Error("Published host URL must use HTTPS.");
  const catalogOrigin = catalogUrl.origin;
  const allowed = new Set([
    catalogOrigin,
    ...(runtime.assetOrigins || []).map((value) => new URL(value).origin),
    ...(runtime.externalRegistryUrls || []).map((value) => new URL(value).origin)
  ]);
  if (!allowed.has(url.origin)) throw new Error("Selected host URL uses an origin not approved by bootstrap assetOrigins.");
}

async function validateIntegrity(bytes, expected) {
  if (!String(expected).startsWith("sha256-")) throw new Error("Host integrity must use SHA-256 SRI.");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  if ("sha256-" + btoa(binary) !== expected) throw new Error("Selected host remote entry failed integrity validation.");
}

function showFatalError(error) {
  const root = document.getElementById("atlas-host-root") || document.body;
  root.replaceChildren();
  const panel = document.createElement("main");
  panel.setAttribute("role", "alert");
  const heading = document.createElement("h1");
  heading.textContent = "Product failed to start";
  const message = document.createElement("p");
  message.textContent = error instanceof Error ? error.message : String(error);
  const retry = document.createElement("button");
  retry.textContent = "Retry";
  retry.onclick = () => location.reload();
  const reset = document.createElement("button");
  reset.textContent = "Clear overrides and reload";
  reset.onclick = () => {
    localStorage.removeItem(DOCUMENT_KEY);
    sessionStorage.removeItem(DOCUMENT_KEY);
    localStorage.removeItem(URL_KEY);
    location.reload();
  };
  panel.append(heading, message, retry, reset);
  root.append(panel);
  console.error("Atlas host client failed to start:", error);
}
`;
