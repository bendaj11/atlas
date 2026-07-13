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
  allowOverrides?: boolean;
  catalog: Record<string, unknown>;
  devSession: Record<string, unknown>;
  disabledAppIds?: string[];
}

export async function runCatalogInterceptor(scenario: InterceptorScenario): Promise<{ catalog: unknown; devSessionRequests: number }> {
  const source = await readColumbusFile("dist/content-script.js");
  const storage = createStorage(scenario.disabledAppIds);
  let devSessionRequests = 0;
  const nativeFetch = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.endsWith("/atlas.runtime.json")) {
      return jsonResponse({ schemaVersion: "1", hostId: "test-host", catalogUrl: "https://registry.test/hosts/test-host/catalog.json", allowOverrides: scenario.allowOverrides ?? true });
    }
    if (url.startsWith("http://127.0.0.1:4400/atlas.dev-session.json")) {
      devSessionRequests += 1;
      return jsonResponse(scenario.devSession);
    }
    return jsonResponse(scenario.catalog);
  };
  const pageWindow = { fetch: nativeFetch };
  runInNewContext(source, {
    window: pageWindow,
    location: { href: "https://host.test/dashboard" },
    localStorage: storage.local,
    sessionStorage: storage.session,
    Request,
    Response,
    URL,
    Map,
    Set
  });

  await pageWindow.fetch("https://host.test/atlas.runtime.json");
  const response = await pageWindow.fetch("https://registry.test/hosts/test-host/catalog.json");
  const catalog: unknown = JSON.parse(JSON.stringify(await response.json()));
  return { catalog, devSessionRequests };
}

function createStorage(disabledAppIds: string[] = []): { local: Storage; session: Storage } {
  const values = new Map<string, string>();
  if (disabledAppIds.length) values.set("atlas.disabled-local-apps.test-host", JSON.stringify(disabledAppIds));
  const storage: Storage = Object.create(null);
  Object.defineProperty(storage, "length", { get: () => values.size });
  storage.clear = () => { values.clear(); };
  storage.getItem = (key) => values.get(key) ?? null;
  storage.key = (index) => Array.from(values.keys())[index] ?? null;
  storage.removeItem = (key) => { values.delete(key); };
  storage.setItem = (key, value) => { values.set(key, value); };
  const session: Storage = Object.create(storage);
  session.getItem = () => null;
  return { local: storage, session };
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
