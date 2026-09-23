import type { HostData, HostPageState } from '../../types/host-data';
import { isRecord } from '../messages/messages';
import { hostDataCacheKey } from '../storage-keys/storage-keys';
import { isExtensionPageUrl, isWebPageUrl } from '../urls/urls';

export type CachedHostData = Omit<HostData, keyof HostPageState>;

export interface CachedHost {
  hostData: CachedHostData;
  tabId: number;
}

interface HostDataSnapshot extends CachedHost {
  tabUrl: string;
}

interface WriteHostDataCacheOptions {
  hostData: HostData;
  tabId: number;
  tabUrl: string;
}

export async function readHostDataCache(): Promise<CachedHost | undefined> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const activeTab = tabs.find((tab) => tab.active === true);
  const candidateTabs = isExtensionPageUrl(activeTab?.url)
    ? webTabsByRecency(tabs)
    : [activeTab];

  for (const tab of candidateTabs) {
    const snapshot = await readSnapshot(tab);
    if (snapshot) return { hostData: snapshot.hostData, tabId: snapshot.tabId };
  }

  return undefined;
}

export async function writeHostDataCache({
  hostData,
  tabId,
  tabUrl,
}: WriteHostDataCacheOptions): Promise<void> {
  const { visibleAppIds, runtimeErrors, ...cachedHostData } = hostData;
  const snapshot: HostDataSnapshot = {
    hostData: cachedHostData,
    tabId,
    tabUrl,
  };

  await chrome.storage.session.set({ [hostDataCacheKey(tabId)]: snapshot });
}

export async function clearHostDataCache(tabId: number): Promise<void> {
  await chrome.storage.session.remove(hostDataCacheKey(tabId));
}

async function readSnapshot(
  tab: chrome.tabs.Tab | undefined,
): Promise<HostDataSnapshot | undefined> {
  if (tab?.id === undefined) return undefined;

  const key = hostDataCacheKey(tab.id);
  const stored = await chrome.storage.session.get(key);
  const snapshot = stored[key];
  if (!isHostDataSnapshot(snapshot)) return undefined;

  if (snapshot.tabUrl !== tab.url) {
    await chrome.storage.session.remove(key);

    return undefined;
  }

  return snapshot;
}

function webTabsByRecency(tabs: chrome.tabs.Tab[]): chrome.tabs.Tab[] {
  return tabs
    .filter((tab) => isWebPageUrl(tab.url))
    .sort(
      (left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0),
    );
}

function isHostDataSnapshot(value: unknown): value is HostDataSnapshot {
  return (
    isRecord(value) &&
    Number.isInteger(value.tabId) &&
    typeof value.tabUrl === 'string' &&
    isRecord(value.hostData) &&
    isRecord(value.hostData.config) &&
    typeof value.hostData.config.hostId === 'string'
  );
}
