import { artifactKey, type AtlasExtensionManifest as Manifest, type AtlasHostData as HostData, type AtlasOverrideDocument as OverrideDocument } from "../contracts.js";
import { BADGE_BACKGROUND_COLOR, BADGE_TEXT_COLOR, DOCUMENT_KEY, URL_KEY } from "./constants.js";
import type { Scope } from "./types.js";
import { normalizeStoredManifest } from "./manifest-utils.js";

export async function readHostData(activeTabId: number | undefined): Promise<{ hostData: HostData; tabId: number }> {
  const tab = await findInspectableHostTab();
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    func: inspectAtlasHost,
    args: [DOCUMENT_KEY]
  });

  if (!injection?.result) throw new Error("Active page did not return Atlas runtime information.");

  const hostData = injection.result;
  if (hostData.config.allowOverrides !== true) {
    throw new Error(`Atlas host "${hostData.config.hostId}" disables host and app overrides. Set ATLAS_ALLOW_OVERRIDES=true on the host-server container.`);
  }
  if (!hostData.overrides) hostData.overrides = await readPersistedOverrides(hostData);
  await updateActionBadge(tab.id, overrideCount(hostData.overrides));

  if (activeTabId && activeTabId !== tab.id) await updateActionBadge(activeTabId, 0);

  return { hostData, tabId: tab.id };
}

export function createOverrideDocument(hostData: HostData, overrides: Map<string, Manifest>): OverrideDocument {
  const selected = [...overrides.values()];
  const host = selected.find((manifest) => manifest.kind === "host");
  return {
    schemaVersion: "1",
    hostId: hostData.config.hostId,
    generatedAt: new Date().toISOString(),
    ...(host ? { host: { manifest: host, reason: overrideReason(host) } } : {}),
    apps: selected.filter((manifest) => manifest.kind === "app").map((manifest) => ({ manifest, reason: overrideReason(manifest) }))
  };
}

export async function writeOverrides({ tabId, hostData, documentValue, scope, disabledAppIds = [] }: {
  tabId: number;
  hostData: HostData;
  documentValue: OverrideDocument;
  scope: Scope;
  disabledAppIds?: string[];
}): Promise<void> {
  const storageKey = `atlas.overrides.${hostData.config.hostId}`;

  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: persistOverrides,
    args: [DOCUMENT_KEY, URL_KEY, JSON.stringify({ documentValue, scope, disabledAppIds })]
  });
  const count = overrideCount(documentValue);
  if (scope === "all" && count) await chrome.storage.local.set({ [storageKey]: documentValue });
  if (scope === "all" && !count) await chrome.storage.local.remove(storageKey);
  await updateActionBadge(tabId, count);
  await chrome.tabs.reload(tabId);
}

export async function updateActionBadge(tabId: number, overrideCount: number): Promise<void> {
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_BACKGROUND_COLOR });
  await chrome.action.setBadgeTextColor?.({ color: BADGE_TEXT_COLOR });
  await chrome.action.setBadgeText({ tabId, text: overrideCount > 0 ? String(overrideCount) : "" });
}

export async function readDisabledOverrides(hostId: string, tabId: number, scope: Scope): Promise<Map<string, Manifest>> {
  const key = disabledOverridesKey(hostId, tabId, scope);
  const stored = await chrome.storage.local.get(key);
  let value = stored[key];
  if (!Array.isArray(value) && scope === "all") {
    const legacyKey = `atlas.disabled-overrides.${hostId}`;
    const legacyStored = await chrome.storage.local.get(legacyKey);
    value = legacyStored[legacyKey];
    if (Array.isArray(value)) {
      await chrome.storage.local.set({ [key]: value });
      await chrome.storage.local.remove(legacyKey);
    }
  }
  const manifests = Array.isArray(value) ? value.filter(isStoredManifest) : [];
  return new Map(manifests.map((manifest) => {
    const normalized = normalizeStoredManifest(manifest);
    return [artifactKey(normalized), normalized];
  }));
}

function isStoredManifest(value: unknown): value is Manifest {
  if (typeof value !== "object" || value === null) return false;
  const manifest = value as Partial<Manifest>;
  return manifest.schemaVersion === "1"
    && typeof manifest.id === "string"
    && typeof manifest.version === "string"
    && typeof manifest.buildId === "string"
    && typeof manifest.remoteEntryUrl === "string";
}

export async function writeDisabledOverrides({ hostId, tabId, scope, overrides }: {
  hostId: string;
  tabId: number;
  scope: Scope;
  overrides: Map<string, Manifest>;
}): Promise<void> {
  const key = disabledOverridesKey(hostId, tabId, scope);
  if (overrides.size === 0) {
    await chrome.storage.local.remove(key);
    return;
  }
  await chrome.storage.local.set({ [key]: [...overrides.values()] });
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readPersistedOverrides(hostData: HostData): Promise<OverrideDocument | undefined> {
  const key = `atlas.overrides.${hostData.config.hostId}`;
  const persisted = await chrome.storage.local.get(key);
  return persisted[key] as OverrideDocument | undefined;
}

async function findInspectableHostTab(): Promise<chrome.tabs.Tab & { id: number; url: string }> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (isInspectableTab(activeTab)) return activeTab;
  throw new Error("Open an Atlas host in the active tab first.");
}

function isInspectableTab(tab: chrome.tabs.Tab | undefined): tab is chrome.tabs.Tab & { id: number; url: string } {
  return typeof tab?.id === "number" && typeof tab.url === "string" && tab.url.startsWith("http");
}

async function inspectAtlasHost(documentKey: string): Promise<HostData> {
  function manifestKey(manifest: Manifest): string {
    return `${manifest.kind}:${manifest.id}`;
  }

  async function readAtlasConfig(): Promise<HostData["config"]> {
    const response = await fetch("/atlas.runtime.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Atlas runtime configuration returned ${response.status}.`);

    const config = await response.json() as HostData["config"];
    if (config.schemaVersion !== "1" || !config.hostId || !config.catalogUrl) throw new Error("This page does not expose a valid Atlas runtime configuration.");

    return config;
  }

  async function readAtlasCatalog(catalogUrl: URL): Promise<HostData["catalog"]> {
    const response = await fetch(catalogUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Atlas catalog returned ${response.status}.`);

    return response.json() as Promise<HostData["catalog"]>;
  }

  async function readManifestVersions(manifest: Manifest, registryRoot: string): Promise<{ entry: readonly [string, Manifest[]]; error?: string }> {
    try {
      const response = await fetch(`${registryRoot}/${manifest.kind === "host" ? "hosts" : "apps"}/${encodeURIComponent(manifest.id)}/index.json`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Version lookup for ${manifest.id} returned ${response.status}.`);

      const index = await response.json() as { manifests?: Manifest[] };
      if (!Array.isArray(index.manifests)) throw new Error(`Version lookup for ${manifest.id} returned an invalid index.`);

      return { entry: [manifestKey(manifest), index.manifests] as const };
    } catch (error) {
      return { entry: [manifestKey(manifest), [manifest]] as const, error: messageFromError(error) };
    }
  }

  async function readExternalProviders(
    config: HostData["config"],
    catalog: HostData["catalog"]
  ): Promise<{ providers: Manifest[]; versions: Array<readonly [string, Manifest[]]>; errors: string[] }> {
    const dependencyIds = new Set(catalog.apps.flatMap((manifest) => manifest.externalAppsDependencies ?? []));
    if (dependencyIds.size === 0) return { providers: [], versions: [], errors: [] };
    const results = await Promise.all((config.externalRegistryUrls ?? []).map(async (baseUrl) => {
      try {
        const response = await fetch(`${baseUrl.replace(/\/$/, "")}/registry.json`, { cache: "no-store" });
        if (!response.ok) throw new Error(`External registry ${baseUrl} returned ${response.status}.`);
        const registry = await response.json() as {
          apps?: Manifest[];
          selections?: { apps?: Record<string, { version: string; buildId: string }> };
        };
        if (!Array.isArray(registry.apps)) throw new Error(`External registry ${baseUrl} returned invalid apps.`);
        return { registry, error: undefined };
      } catch (error) {
        return { registry: undefined, error: messageFromError(error) };
      }
    }));
    const registries = results.flatMap(({ registry }) => registry ? [registry] : []);
    const providers: Manifest[] = [];
    const versions: Array<readonly [string, Manifest[]]> = [];
    const pending = [...dependencyIds];
    const resolved = new Set<string>();
    while (pending.length) {
      const appId = pending.shift()!;
      if (resolved.has(appId)) continue;
      const candidates = registries.flatMap((registry) => {
        const appVersions = registry.apps!.filter((manifest) => manifest.id === appId);
        if (appVersions.length) versions.push([`app:${appId}`, appVersions]);
        const selection = registry.selections?.apps?.[appId];
        const production = appVersions.filter((manifest) => manifest.channel === "production");
        const selected = selection
          ? production.find((manifest) => manifest.version === selection.version && manifest.buildId === selection.buildId)
          : production.sort((left, right) => right.createdAt!.localeCompare(left.createdAt!))[0];
        return selected ? [selected] : [];
      });
      if (candidates.length === 1) {
        const provider = candidates[0]!;
        providers.push(provider);
        pending.push(...(provider.externalAppsDependencies ?? []));
      }
      resolved.add(appId);
    }
    return {
      providers,
      versions,
      errors: results.flatMap(({ error }) => error ? [error] : [])
    };
  }

  function atlasRegistryRoot(catalogUrl: URL): string {
    const hostsMarker = "/hosts/";
    const markerIndex = catalogUrl.pathname.indexOf(hostsMarker);

    if (markerIndex < 0) throw new Error("Atlas catalog URL does not identify a static Atlas registry.");

    return `${catalogUrl.origin}${catalogUrl.pathname.slice(0, markerIndex)}`;
  }

  function readStoredOverrideDocument(): { overrides: OverrideDocument | undefined; overrideScope: Scope | undefined } {
    const tabStored = sessionStorage.getItem(documentKey);
    const stored = tabStored ?? localStorage.getItem(documentKey);

    if (!stored) return { overrides: undefined, overrideScope: undefined };

    try {
      return { overrides: JSON.parse(stored) as OverrideDocument, overrideScope: tabStored ? "tab" : "all" };
    } catch {
      return { overrides: undefined, overrideScope: tabStored ? "tab" : "all" };
    }
  }

  function messageFromError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  const config = await readAtlasConfig();
  const catalogUrl = new URL(config.catalogUrl, location.href);
  const catalog = await readAtlasCatalog(catalogUrl);
  const external = await readExternalProviders(config, catalog);
  const registryRoot = atlasRegistryRoot(catalogUrl);
  const selectedArtifacts = [catalog.host, ...catalog.apps];
  const versionResults = await Promise.all(selectedArtifacts.map((manifest) => readManifestVersions(manifest, registryRoot)));
  const versions = Object.fromEntries([...versionResults.map(({ entry }) => entry), ...external.versions]);
  const storedSelection = readStoredOverrideDocument();
  const localSelections = selectedArtifacts.filter((manifest) => manifest.channel === "local");
  const overrides = storedSelection.overrides ?? (localSelections.length ? {
    schemaVersion: "1" as const,
    hostId: config.hostId,
    generatedAt: new Date().toISOString(),
    ...(localSelections.find((manifest) => manifest.kind === "host") ? { host: { manifest: localSelections.find((manifest) => manifest.kind === "host")!, reason: "local" as const } } : {}),
    apps: localSelections.filter((manifest) => manifest.kind === "app").map((manifest) => ({ manifest, reason: "local" as const }))
  } : undefined);
  const productionCatalog = {
    ...catalog,
    host: catalog.host.channel === "local"
      ? versions[manifestKey(catalog.host)]?.find((version) => version.channel === "production") ?? catalog.host
      : catalog.host,
    apps: catalog.apps.map((manifest) => {
      if (manifest.channel !== "local") return manifest;
      return versions[manifestKey(manifest)]?.find((version) => version.channel === "production") ?? manifest;
    }),
    widgetProviders: external.providers
  };
  const runtimeErrors = [...document.querySelectorAll<HTMLElement>('[data-atlas-state="error"]')]
    .map((element) => element.textContent?.trim() || element.getAttribute("data-atlas-app") || "Unknown app error");
  const versionErrors = [
    ...versionResults.map(({ error }) => error).filter((error): error is string => Boolean(error)),
    ...external.errors
  ];

  return {
    config,
    pageUrl: location.href,
    catalog: productionCatalog,
    versions,
    overrides,
    overrideScope: storedSelection.overrideScope,
    runtimeErrors,
    versionErrors
  };
}

function persistOverrides(documentKey: string, urlKey: string, value: string): void {
  const { documentValue, scope, disabledAppIds } = JSON.parse(value) as {
    documentValue: OverrideDocument;
    scope: Scope;
    disabledAppIds: string[];
  };
  const serializedDocument = JSON.stringify(documentValue);

  if (scope === "all") {
    if (documentValue.apps.length + (documentValue.host ? 1 : 0)) localStorage.setItem(documentKey, serializedDocument);
    else localStorage.removeItem(documentKey);
    sessionStorage.removeItem(documentKey);
  } else {
    sessionStorage.setItem(documentKey, serializedDocument);
  }

  const disabledKey = `atlas.disabled-local-apps.${documentValue.hostId}`;
  if (scope === "all") {
    if (disabledAppIds.length) localStorage.setItem(disabledKey, JSON.stringify(disabledAppIds));
    else localStorage.removeItem(disabledKey);
    sessionStorage.removeItem(disabledKey);
  } else {
    sessionStorage.setItem(disabledKey, JSON.stringify(disabledAppIds));
  }

  localStorage.removeItem(urlKey);
  const url = new URL(location.href);
  url.searchParams.delete("atlas-override");
  history.replaceState(history.state, "", url);
}

function overrideReason(manifest: Manifest): "local" | "pr" | "past-production" {
  if (manifest.channel === "local") return "local";
  if (manifest.channel === "pr") return "pr";
  return "past-production";
}

function overrideCount(documentValue: OverrideDocument | undefined): number {
  return documentValue ? documentValue.apps.length + (documentValue.host ? 1 : 0) : 0;
}

function disabledOverridesKey(hostId: string, tabId: number, scope: Scope): string {
  return scope === "tab"
    ? `atlas.disabled-overrides.${hostId}.tab.${tabId}`
    : `atlas.disabled-overrides.${hostId}.all`;
}
