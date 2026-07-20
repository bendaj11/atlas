import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

export function readColumbusFile(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

export async function readColumbusJson(path: string): Promise<unknown> {
  return JSON.parse(await readColumbusFile(path));
}

export interface ColumbusManifest {
  manifest_version: number;
  minimum_chrome_version: string;
  permissions: string[];
  host_permissions: string[];
  content_scripts: Array<{ run_at: string; world?: string; matches: string[]; js: string[] }>;
  action: { default_popup: string; default_icon: Record<string, string> };
  icons: Record<string, string>;
  background: { service_worker: string };
}

export async function readColumbusManifest(): Promise<ColumbusManifest> {
  const value = await readColumbusJson("dist/manifest.json");
  if (!isColumbusManifest(value)) {
    throw new Error("Columbus build manifest has an invalid shape.");
  }
  return value;
}

interface InterceptorScenario {
  allowCustomOverrides?: boolean;
  catalog: Record<string, unknown>;
  devSession: Record<string, unknown>;
  disabledAppIds?: string[];
  localDevelopmentIntent?: boolean;
  localDevelopmentScope?: "all" | "tab";
  pageHostname?: string;
  storedOverrideDocument?: Record<string, unknown>;
}

export async function runCatalogInterceptor(scenario: InterceptorScenario): Promise<{
  catalog: unknown;
  devSessionRequests: number;
  storedOverrideScope: "all" | "tab" | undefined;
  storedOverrides: unknown;
}> {
  const source = await readColumbusFile("dist/content-script.js");
  const storage = createStorage(scenario);
  let devSessionRequests = 0;
  const nativeFetch = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.endsWith("/atlas.runtime.json")) {
      return jsonResponse({ schemaVersion: "1", hostId: "test-host", catalogUrl: "https://registry.test/hosts/test-host/catalog.json", allowCustomOverrides: scenario.allowCustomOverrides ?? true });
    }
    if (url.startsWith("http://localhost:4400/atlas.dev-session.json")) {
      devSessionRequests += 1;
      return jsonResponse(scenario.devSession);
    }
    return jsonResponse(scenario.catalog);
  };
  const pageWindow = { fetch: nativeFetch };
  const pageUrl = new URL("https://host.test/dashboard");
  runInNewContext(source, {
    window: pageWindow,
    location: { href: pageUrl.href, hostname: scenario.pageHostname ?? "host.test" },
    localStorage: storage.local,
    sessionStorage: storage.session,
    Request,
    Response,
    URL,
    URLSearchParams,
    Map,
    Set
  });

  await pageWindow.fetch("https://host.test/atlas.runtime.json");
  const response = await pageWindow.fetch("https://registry.test/hosts/test-host/catalog.json");
  const catalog: unknown = JSON.parse(JSON.stringify(await response.json()));
  const sessionOverrides = storage.session.getItem("atlas.runtime-overrides");
  const localOverrides = storage.local.getItem("atlas.runtime-overrides");
  const storedOverrides = sessionOverrides ?? localOverrides;
  return {
    catalog,
    devSessionRequests,
    storedOverrideScope: sessionOverrides ? "tab" : localOverrides ? "all" : undefined,
    storedOverrides: storedOverrides ? JSON.parse(storedOverrides) as unknown : undefined
  };
}

function createStorage(scenario: InterceptorScenario): { local: Storage; session: Storage } {
  const localValues = new Map<string, string>();
  const sessionValues = new Map<string, string>();
  if (scenario.disabledAppIds?.length) {
    localValues.set("atlas.disabled-local-apps.test-host", JSON.stringify(scenario.disabledAppIds));
  }
  if (scenario.localDevelopmentIntent) {
    const values = scenario.localDevelopmentScope === "tab" ? sessionValues : localValues;
    const overrides = Array.isArray(scenario.devSession.overrides)
      ? scenario.devSession.overrides
      : [];
    values.set("atlas.runtime-overrides", JSON.stringify(
      scenario.storedOverrideDocument ?? {
        schemaVersion: "1",
        hostId: "test-host",
        overrides: overrides.map((override) => ({
          ...(override as Record<string, unknown>),
          reason: "local",
        })),
        generatedAt: "2026-01-01T00:00:00.000Z"
      },
    ));
  }
  return {
    local: createStorageArea(localValues),
    session: createStorageArea(sessionValues)
  };
}

function createStorageArea(values: Map<string, string>): Storage {
  const storage = Object.create(null) as Storage;
  Object.defineProperty(storage, "length", { get: () => values.size });
  storage.clear = () => { values.clear(); };
  storage.getItem = (key) => values.get(key) ?? null;
  storage.key = (index) => Array.from(values.keys())[index] ?? null;
  storage.removeItem = (key) => { values.delete(key); };
  storage.setItem = (key, value) => { values.set(key, value); };
  return storage;
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}

function isColumbusManifest(value: unknown): value is ColumbusManifest {
  return isRecord(value) && typeof value.manifest_version === "number" && typeof value.minimum_chrome_version === "string" && Array.isArray(value.permissions)
    && Array.isArray(value.host_permissions) && Array.isArray(value.content_scripts)
    && isRecord(value.action) && isRecord(value.icons) && isRecord(value.background);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
