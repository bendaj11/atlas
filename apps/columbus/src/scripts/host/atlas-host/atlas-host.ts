import {
  type AtlasExtensionManifest as Manifest,
  type AtlasHostData as HostData,
  type AtlasOverrideDocument as OverrideDocument,
  getArtifactKey,
} from '../../../types/contracts';
import { writeHostDataCache } from '../host-data-cache';
import type { Scope } from '../../../types/app';
import { normalizeStoredManifest } from '../../manifests/manifest-utils/manifest-utils';
import { failureMessage } from '../../shared/errors/errors';
import {
  inspectHostRequest,
  isHostDataResponse,
  isManifestResponse,
  loadArtifactVersionRequest,
  isRecord,
} from '../../shared/messages/messages';
import {
  OVERRIDE_DOCUMENT_KEY,
  disabledLocalAppsKey,
  disabledOverridesKey,
  persistedOverridesKey,
  suppressedArtifactsKey,
} from '../../shared/storage-keys/storage-keys';
import {
  isExtensionPageUrl,
  isLoopbackUrl,
  isWebPageUrl,
} from '../../shared/urls/urls';
import {
  countOverrides,
  isStoredManifest,
  isStoredOverrideDocument,
} from '../../overrides/override-document/override-document';

interface DisabledOverrideStorageLocation {
  hostId: string;
  tabId: number;
  scope: Scope;
}

interface WriteDisabledOverridesOptions extends DisabledOverrideStorageLocation {
  overrides: Map<string, Manifest>;
}

interface WriteSuppressedArtifactIdsOptions extends DisabledOverrideStorageLocation {
  artifactIds: Set<string>;
}

export async function readHostData(): Promise<{
  hostData: HostData;
  tabId: number;
}> {
  const { tab, hostData } = await findAtlasHostTab();

  if (!hostData.overrides)
    hostData.overrides = await readPersistedOverrides(hostData);
  await writeHostDataCache({ hostData, tabId: tab.id, tabUrl: tab.url! }).catch(
    () => undefined,
  );

  return { hostData, tabId: tab.id };
}

export async function loadArtifactVersion(options: {
  tabId: number;
  artifactKey: string;
  versionKey: string;
}): Promise<Manifest> {
  const response = await chrome.tabs.sendMessage(
    options.tabId,
    loadArtifactVersionRequest(options.artifactKey, options.versionKey),
  );
  if (!isManifestResponse(response))
    throw new Error(
      'Active page did not return the selected artifact version.',
    );
  if (!response.ok) throw new Error(response.error);
  return response.manifest;
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
  if (isExtensionPageUrl(activeTab.url)) {
    for (const tab of recentWebTabs(tabs, activeTab.id)) {
      try {
        return { tab, hostData: await inspectTab(tab) };
      } catch {
        continue;
      }
    }
    throw new Error('Open an Atlas host in the active tab first.');
  }
  if (!isWebPageUrl(activeTab.url))
    throw new Error('Open an Atlas host in the active tab first.');

  let activeHostData: HostData | undefined;
  let activeError: unknown;
  try {
    activeHostData = await inspectTab(activeTab);
    return { tab: activeTab, hostData: activeHostData };
  } catch (error) {
    activeError = error;
  }

  if (!isLoopbackUrl(activeTab.url)) throw activeError;

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
    failureMessage(
      activeError,
      'inspect the active host page',
      'Open the Atlas App Preview URL printed by atlas dev, activate that browser tab, then reopen Columbus.',
    ),
  );
}

async function inspectTab(tab: InspectableTab): Promise<HostData> {
  const response = await chrome.tabs.sendMessage(
    tab.id,
    inspectHostRequest(OVERRIDE_DOCUMENT_KEY),
  );
  if (!isHostDataResponse(response))
    throw new Error('Active page did not return Atlas runtime information.');
  if (!response.ok) throw new Error(response.error);
  return response.hostData;
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
  const storageKey = persistedOverridesKey(hostData.config.hostId);

  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: persistOverrides,
    args: [
      OVERRIDE_DOCUMENT_KEY,
      disabledLocalAppsKey(hostData.config.hostId),
      JSON.stringify({ documentValue, scope, disabledAppIds }),
    ],
  });
  const count = countOverrides(documentValue);
  if (scope === 'all' && count)
    await chrome.storage.local.set({ [storageKey]: documentValue });
  if (scope === 'all' && !count) await chrome.storage.local.remove(storageKey);
}

export async function validateLocalOverride(manifest: Manifest): Promise<void> {
  if (manifest.channel !== 'local') return;
  const error = await validateLocalRemoteEntry(
    manifest.remoteEntryUrl,
    manifest.exposes?.entry ?? './entry',
  );
  if (error) throw new Error(error);
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

export async function readSuppressedArtifactIds({
  hostId,
  tabId,
  scope,
}: DisabledOverrideStorageLocation): Promise<Set<string>> {
  const key = suppressedArtifactsKey(hostId, tabId, scope);
  const stored = await chrome.storage.local.get(key);
  const value = stored[key];
  return new Set(
    Array.isArray(value)
      ? value.filter(
          (artifactId): artifactId is string =>
            typeof artifactId === 'string' && artifactId.length > 0,
        )
      : [],
  );
}

export async function writeSuppressedArtifactIds({
  hostId,
  tabId,
  scope,
  artifactIds,
}: WriteSuppressedArtifactIdsOptions): Promise<void> {
  const key = suppressedArtifactsKey(hostId, tabId, scope);
  if (artifactIds.size === 0) {
    await chrome.storage.local.remove(key);
    return;
  }
  await chrome.storage.local.set({ [key]: [...artifactIds] });
}

async function readPersistedOverrides(
  hostData: HostData,
): Promise<OverrideDocument | undefined> {
  const key = persistedOverridesKey(hostData.config.hostId);
  const persisted = await chrome.storage.local.get(key);
  const value = persisted[key];
  return isStoredOverrideDocument(value) &&
    value.hostId === hostData.config.hostId
    ? value
    : undefined;
}

type InspectableTab = chrome.tabs.Tab & { id: number };

function localPreviewCandidates(
  tabs: chrome.tabs.Tab[],
  activeTabId: number,
): InspectableTab[] {
  return tabs
    .filter(
      (tab): tab is InspectableTab =>
        hasTabId(tab) && tab.id !== activeTabId && isLoopbackUrl(tab.url),
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
        hasTabId(tab) && tab.id !== activeTabId && isWebPageUrl(tab.url),
    )
    .sort(
      (left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0),
    );
}

function hasTabId(tab: chrome.tabs.Tab): tab is InspectableTab {
  return typeof tab.id === 'number';
}

function persistOverrides(
  documentKey: string,
  disabledKey: string,
  value: string,
): void {
  const { documentValue, scope, disabledAppIds } = JSON.parse(value) as {
    documentValue: OverrideDocument;
    scope: Scope;
    disabledAppIds: string[];
  };
  const serializedDocument = JSON.stringify(documentValue);

  if (scope === 'all') {
    const shouldPersistDocument =
      documentValue.overrides.length + (documentValue.hostOverride ? 1 : 0) >
        0 || disabledAppIds.length > 0;
    if (shouldPersistDocument)
      localStorage.setItem(documentKey, serializedDocument);
    else localStorage.removeItem(documentKey);
    sessionStorage.removeItem(documentKey);
  } else {
    sessionStorage.setItem(documentKey, serializedDocument);
  }

  if (scope === 'all') {
    if (disabledAppIds.length)
      localStorage.setItem(disabledKey, JSON.stringify(disabledAppIds));
    else localStorage.removeItem(disabledKey);
    sessionStorage.removeItem(disabledKey);
  } else {
    sessionStorage.setItem(disabledKey, JSON.stringify(disabledAppIds));
  }
}

async function validateLocalRemoteEntry(
  remoteEntryUrl: string,
  exposedModule: string,
): Promise<string | undefined> {
  const isFederationMetadata = (
    value: unknown,
  ): value is {
    name: string;
    exposes: Array<{ key?: unknown; outFileName?: unknown }>;
  } => {
    if (!isRecord(value)) return false;
    const metadata = value as Partial<{ name: unknown; exposes: unknown }>;
    return typeof metadata.name === 'string' && Array.isArray(metadata.exposes);
  };
  try {
    const response = await fetch(remoteEntryUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok)
      return `Local override remote entry returned HTTP ${response.status}.`;
    const metadata: unknown = await response.json();
    if (!isFederationMetadata(metadata))
      return 'Local override remote entry is not valid federation metadata.';
    const expose = metadata.exposes.find(
      (candidate) => candidate.key === exposedModule,
    );
    if (typeof expose?.outFileName !== 'string')
      return `Local override remote entry does not expose ${exposedModule}.`;
    return undefined;
  } catch {
    return 'Local override remote entry is unreachable. Start its development server, then retry.';
  }
}
