import type { AtlasHostData as HostData } from '../../types/contracts.js';

const HOST_DATA_CACHE_KEY = 'atlas.host-data-cache';

interface HostDataSnapshot {
  hostData: HostData;
  tabId: number;
  tabUrl: string;
}

export async function readHostDataCache(): Promise<
  Omit<HostDataSnapshot, 'tabUrl'> | undefined
> {
  const stored = await chrome.storage.session.get(HOST_DATA_CACHE_KEY);
  const snapshot = stored[HOST_DATA_CACHE_KEY];
  if (!isHostDataSnapshot(snapshot)) return undefined;

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const activeTab = tabs.find((tab) => tab.active === true);
  const cachedTab = tabs.find((tab) => tab.id === snapshot.tabId);
  const cacheMatchesActiveHost =
    cachedTab?.url === snapshot.tabUrl &&
    (activeTab?.id === snapshot.tabId || isExtensionPage(activeTab?.url));

  if (!cacheMatchesActiveHost) {
    await chrome.storage.session.remove(HOST_DATA_CACHE_KEY);
    return undefined;
  }

  return { hostData: snapshot.hostData, tabId: snapshot.tabId };
}

export async function writeHostDataCache(
  snapshot: HostDataSnapshot,
): Promise<void> {
  await chrome.storage.session.set({ [HOST_DATA_CACHE_KEY]: snapshot });
}

export async function clearHostDataCache(tabId?: number): Promise<void> {
  if (tabId === undefined) {
    await chrome.storage.session.remove(HOST_DATA_CACHE_KEY);
    return;
  }

  const stored = await chrome.storage.session.get(HOST_DATA_CACHE_KEY);
  const snapshot = stored[HOST_DATA_CACHE_KEY];
  if (isHostDataSnapshot(snapshot) && snapshot.tabId === tabId)
    await chrome.storage.session.remove(HOST_DATA_CACHE_KEY);
}

function isHostDataSnapshot(value: unknown): value is HostDataSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const snapshot = value as Partial<HostDataSnapshot>;
  return (
    Number.isInteger(snapshot.tabId) &&
    typeof snapshot.tabUrl === 'string' &&
    typeof snapshot.hostData?.config?.hostId === 'string'
  );
}

function isExtensionPage(url: string | undefined): boolean {
  return typeof url === 'string' && url.startsWith('chrome-extension://');
}
