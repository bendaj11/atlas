import { artifactKey, type AtlasExtensionManifest as Manifest, type AtlasHostData as HostData, type AtlasOverrideDocument as OverrideDocument } from "../contracts.js";
import { BADGE_BACKGROUND_COLOR, BADGE_TEXT_COLOR, DOCUMENT_KEY, URL_KEY } from "./constants.js";
import { inspectAtlasHost } from "./inspect-atlas-host.js";
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
  const value = persisted[key];
  return isStoredOverrideDocument(value) ? value : undefined;
}

function isStoredOverrideDocument(value: unknown): value is OverrideDocument {
  if (typeof value !== "object" || value === null) return false;
  const documentValue = value as Partial<OverrideDocument>;
  return documentValue.schemaVersion === "1"
    && typeof documentValue.hostId === "string"
    && typeof documentValue.generatedAt === "string"
    && (documentValue.host === undefined || isStoredOverride(documentValue.host))
    && Array.isArray(documentValue.apps)
    && documentValue.apps.every(isStoredOverride);
}

function isStoredOverride(value: unknown): value is OverrideDocument["apps"][number] {
  if (typeof value !== "object" || value === null) return false;
  const override = value as Partial<OverrideDocument["apps"][number]>;
  return isStoredManifest(override.manifest)
    && (override.reason === "local" || override.reason === "pr" || override.reason === "past-production");
}

async function findInspectableHostTab(): Promise<chrome.tabs.Tab & { id: number; url: string }> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (isInspectableTab(activeTab)) return activeTab;
  throw new Error("Open an Atlas host in the active tab first.");
}

function isInspectableTab(tab: chrome.tabs.Tab | undefined): tab is chrome.tabs.Tab & { id: number; url: string } {
  return typeof tab?.id === "number" && typeof tab.url === "string" && tab.url.startsWith("http");
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
