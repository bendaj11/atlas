import {
  type AtlasExtensionManifest as Manifest,
  type AtlasHostData as HostData,
  type AtlasOverrideDocument as OverrideDocument,
  getArtifactKey,
} from '../../../types/contracts.js';
import { DOCUMENT_KEY, URL_KEY } from '../../shared/constants.js';
import { inspectAtlasHost } from '../inspect-atlas-host/inspect-atlas-host.js';
import { writeHostDataCache } from '../host-data-cache.js';
import type { Scope } from '../../../types/app.js';
import { normalizeStoredManifest } from '../../manifests/manifest-utils/manifest-utils.js';

interface DisabledOverrideStorageLocation {
  hostId: string;
  tabId: number;
  scope: Scope;
}

interface WriteDisabledOverridesOptions extends DisabledOverrideStorageLocation {
  overrides: Map<string, Manifest>;
}

interface CreateOverrideDocumentOptions {
  hostData: HostData;
  overrides: Map<string, Manifest>;
}

export async function readHostData(): Promise<{
  hostData: HostData;
  tabId: number;
}> {
  const { tab, hostData } = await findAtlasHostTab();

  if (!hostData.overrides)
    hostData.overrides = await readPersistedOverrides(hostData);
  hostData.overrides = resolveLatestPrOverrides({
    hostData,
    overrideDocument: hostData.overrides,
  });

  await writeHostDataCache({ hostData, tabId: tab.id, tabUrl: tab.url! }).catch(
    () => undefined,
  );

  return { hostData, tabId: tab.id };
}

function resolveLatestPrOverrides({
  hostData,
  overrideDocument,
}: {
  hostData: HostData;
  overrideDocument: OverrideDocument | undefined;
}): OverrideDocument | undefined {
  if (!overrideDocument) return overrideDocument;
  const latestManifest = (manifest: Manifest): Manifest | undefined => {
    if (manifest.channel !== 'pr' || !manifest.prNumber) return manifest;
    const versions = hostData.versions[getArtifactKey(manifest)];
    if (!versions) return manifest;
    return (
      versions.find(
        (candidate) =>
          candidate.channel === 'pr' &&
          candidate.prNumber === manifest.prNumber,
      ) ?? manifest
    );
  };
  const latest = (
    override: OverrideDocument['overrides'][number],
  ): OverrideDocument['overrides'][number] | undefined => {
    const manifest = latestManifest(override.manifest);
    return manifest ? { ...override, manifest } : undefined;
  };
  const hostOverride = overrideDocument.hostOverride
    ? latestManifest(overrideDocument.hostOverride)
    : undefined;
  const overrides = overrideDocument.overrides.flatMap((override) => {
    const resolved = latest(override);
    return resolved ? [resolved] : [];
  });
  const resolved: OverrideDocument = { ...overrideDocument, overrides };
  if (hostOverride) resolved.hostOverride = hostOverride;
  else delete resolved.hostOverride;
  return resolved;
}

async function findAtlasHostTab(): Promise<{
  tab: InspectableTab;
  hostData: HostData;
}> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const activeTab = tabs.find(
    (tab): tab is InspectableTab => tab.active === true && hasTabId(tab),
  );
  if (!activeTab)
    throw new Error('Open an Atlas host in the active tab first.');
  if (isExtensionPage(activeTab.url)) {
    for (const tab of recentWebTabs(tabs, activeTab.id)) {
      try {
        return { tab, hostData: await inspectTab(tab) };
      } catch {
        continue;
      }
    }
    throw new Error('Open an Atlas host in the active tab first.');
  }
  if (!isWebPage(activeTab.url))
    throw new Error('Open an Atlas host in the active tab first.');

  let activeHostData: HostData | undefined;
  let activeError: unknown;
  try {
    activeHostData = await inspectTab(activeTab);
    return { tab: activeTab, hostData: activeHostData };
  } catch (error) {
    activeError = error;
  }

  if (!isLoopbackPage(activeTab.url)) throw activeError;

  const expectedHostId = activeHostData?.config.hostId;
  const matchingPreviews: Array<{ tab: InspectableTab; hostData: HostData }> =
    [];
  for (const tab of localPreviewCandidates(tabs, activeTab.id)) {
    try {
      const hostData = await inspectTab(tab);
      if (expectedHostId && hostData.config.hostId !== expectedHostId) continue;
      matchingPreviews.push({ tab, hostData });
    } catch {
      continue;
    }
  }

  if (matchingPreviews.length === 1) return matchingPreviews[0]!;
  if (matchingPreviews.length > 1) {
    throw new Error(
      'Multiple local Atlas previews are open. Activate the intended App Preview tab, then open Columbus again.',
    );
  }

  throw new Error(
    `${errorMessage(activeError)} Open the Atlas App Preview URL printed by atlas dev.`,
  );
}

async function inspectTab(tab: InspectableTab): Promise<HostData> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: inspectAtlasHost,
    args: [DOCUMENT_KEY],
  });

  if (!injection?.result)
    throw new Error('Active page did not return Atlas runtime information.');
  return injection.result;
}

export function createOverrideDocument({
  hostData,
  overrides,
}: CreateOverrideDocumentOptions): OverrideDocument {
  const selectedManifests = [...overrides.values()];
  const hostManifest = selectedManifests.find(
    (manifest) => manifest.kind === 'host',
  );
  return {
    schemaVersion: '1',
    hostId: hostData.config.hostId,
    generatedAt: new Date().toISOString(),
    ...(hostManifest ? { hostOverride: hostManifest } : {}),
    overrides: selectedManifests
      .filter((manifest) => manifest.kind === 'app')
      .map((manifest) => ({
        appId: manifest.id,
        manifest,
        reason: overrideReason(manifest),
      })),
  };
}

export async function writeOverrides({
  tabId,
  hostData,
  documentValue,
  scope,
  disabledAppIds = [],
}: {
  tabId: number;
  hostData: HostData;
  documentValue: OverrideDocument;
  scope: Scope;
  disabledAppIds?: string[];
}): Promise<void> {
  const storageKey = `atlas.overrides.${hostData.config.hostId}`;

  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: persistOverrides,
    args: [
      DOCUMENT_KEY,
      URL_KEY,
      JSON.stringify({ documentValue, scope, disabledAppIds }),
    ],
  });
  const count = overrideCount(documentValue);
  if (scope === 'all' && count)
    await chrome.storage.local.set({ [storageKey]: documentValue });
  if (scope === 'all' && !count) await chrome.storage.local.remove(storageKey);
}

export async function reloadHostTab(tabId: number): Promise<void> {
  await chrome.tabs.reload(tabId);
}

export async function readDisabledOverrides({
  hostId,
  tabId,
  scope,
}: DisabledOverrideStorageLocation): Promise<Map<string, Manifest>> {
  const key = disabledOverridesKey(hostId, tabId, scope);
  const stored = await chrome.storage.local.get(key);
  const value = stored[key];
  const manifests = Array.isArray(value) ? value.filter(isStoredManifest) : [];
  return new Map(
    manifests.map((manifest) => {
      const normalized = normalizeStoredManifest(manifest);
      return [getArtifactKey(normalized), normalized];
    }),
  );
}

function isStoredManifest(value: unknown): value is Manifest {
  if (typeof value !== 'object' || value === null) return false;
  const manifest = value as Partial<Manifest>;
  return (
    manifest.schemaVersion === '1' &&
    (manifest.kind === 'host' || manifest.kind === 'app') &&
    typeof manifest.id === 'string' &&
    typeof manifest.name === 'string' &&
    typeof manifest.version === 'string' &&
    typeof manifest.buildId === 'string' &&
    (manifest.channel === 'production' ||
      manifest.channel === 'pr' ||
      manifest.channel === 'local') &&
    (manifest.framework === 'angular' ||
      manifest.framework === 'react' ||
      manifest.framework === 'vue') &&
    typeof manifest.remoteEntryUrl === 'string'
  );
}

export async function writeDisabledOverrides({
  hostId,
  tabId,
  scope,
  overrides,
}: WriteDisabledOverridesOptions): Promise<void> {
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

async function readPersistedOverrides(
  hostData: HostData,
): Promise<OverrideDocument | undefined> {
  const key = `atlas.overrides.${hostData.config.hostId}`;
  const persisted = await chrome.storage.local.get(key);
  const value = persisted[key];
  return isStoredOverrideDocument(value) &&
    value.hostId === hostData.config.hostId
    ? value
    : undefined;
}

function isStoredOverrideDocument(value: unknown): value is OverrideDocument {
  if (typeof value !== 'object' || value === null) return false;
  const documentValue = value as Partial<OverrideDocument>;
  return (
    documentValue.schemaVersion === '1' &&
    typeof documentValue.hostId === 'string' &&
    typeof documentValue.generatedAt === 'string' &&
    (documentValue.hostOverride === undefined ||
      isStoredManifest(documentValue.hostOverride)) &&
    Array.isArray(documentValue.overrides) &&
    documentValue.overrides.every(isStoredOverride)
  );
}

function isStoredOverride(
  value: unknown,
): value is OverrideDocument['overrides'][number] {
  if (typeof value !== 'object' || value === null) return false;
  const override = value as Partial<OverrideDocument['overrides'][number]>;
  return (
    typeof override.appId === 'string' &&
    isStoredManifest(override.manifest) &&
    override.appId === override.manifest.id &&
    (override.reason === 'local' ||
      override.reason === 'pr' ||
      override.reason === 'historical')
  );
}

type InspectableTab = chrome.tabs.Tab & { id: number };

function localPreviewCandidates(
  tabs: chrome.tabs.Tab[],
  activeTabId: number,
): InspectableTab[] {
  return tabs
    .filter(
      (tab): tab is InspectableTab =>
        hasTabId(tab) && tab.id !== activeTabId && isLoopbackPage(tab.url),
    )
    .sort(
      (left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0),
    );
}

function recentWebTabs(
  tabs: chrome.tabs.Tab[],
  activeTabId: number,
): InspectableTab[] {
  return tabs
    .filter(
      (tab): tab is InspectableTab =>
        hasTabId(tab) && tab.id !== activeTabId && isWebPage(tab.url),
    )
    .sort(
      (left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0),
    );
}

function hasTabId(tab: chrome.tabs.Tab): tab is InspectableTab {
  return typeof tab.id === 'number';
}

function isWebPage(url: string | undefined): url is string {
  return (
    typeof url === 'string' &&
    (url.startsWith('http://') || url.startsWith('https://'))
  );
}

function isExtensionPage(url: string | undefined): boolean {
  return typeof url === 'string' && url.startsWith('chrome-extension://');
}

function isLoopbackPage(url: string | undefined): boolean {
  if (!isWebPage(url)) return false;
  const hostname = new URL(url).hostname;
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
}

function persistOverrides(
  documentKey: string,
  urlKey: string,
  value: string,
): void {
  const { documentValue, scope, disabledAppIds } = JSON.parse(value) as {
    documentValue: OverrideDocument;
    scope: Scope;
    disabledAppIds: string[];
  };
  const serializedDocument = JSON.stringify(documentValue);

  if (scope === 'all') {
    if (documentValue.overrides.length + (documentValue.hostOverride ? 1 : 0))
      localStorage.setItem(documentKey, serializedDocument);
    else localStorage.removeItem(documentKey);
    sessionStorage.removeItem(documentKey);
  } else {
    sessionStorage.setItem(documentKey, serializedDocument);
  }

  const disabledKey = `atlas.disabled-local-apps.${documentValue.hostId}`;
  if (scope === 'all') {
    if (disabledAppIds.length)
      localStorage.setItem(disabledKey, JSON.stringify(disabledAppIds));
    else localStorage.removeItem(disabledKey);
    sessionStorage.removeItem(disabledKey);
  } else {
    sessionStorage.setItem(disabledKey, JSON.stringify(disabledAppIds));
  }

  localStorage.removeItem(urlKey);
  const url = new URL(location.href);
  url.searchParams.delete('atlas-override');
  history.replaceState(history.state, '', url);
}

function overrideReason(manifest: Manifest): 'local' | 'pr' | 'historical' {
  if (manifest.channel === 'local') return 'local';
  if (manifest.channel === 'pr') return 'pr';
  return 'historical';
}

function overrideCount(documentValue: OverrideDocument | undefined): number {
  return documentValue
    ? documentValue.overrides.length + (documentValue.hostOverride ? 1 : 0)
    : 0;
}

function disabledOverridesKey(
  hostId: string,
  tabId: number,
  scope: Scope,
): string {
  return scope === 'tab'
    ? `atlas.disabled-overrides.${hostId}.tab.${tabId}`
    : `atlas.disabled-overrides.${hostId}.all`;
}
