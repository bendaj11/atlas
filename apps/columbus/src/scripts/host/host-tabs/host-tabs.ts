import type {
  AtlasExtensionManifest as Manifest,
  AtlasHostData as HostData,
} from '../../../types/contracts';
import { failureMessage } from '../../shared/errors/errors';
import {
  inspectHostRequest,
  isHostDataResponse,
  isManifestResponse,
  loadArtifactVersionRequest,
} from '../../shared/messages/messages';
import { OVERRIDE_DOCUMENT_KEY } from '../../shared/storage-keys/storage-keys';
import {
  isExtensionPageUrl,
  isLoopbackUrl,
  isWebPageUrl,
} from '../../shared/urls/urls';

export type HostTab = chrome.tabs.Tab & { id: number; url: string };

export interface InspectedHostTab {
  tab: HostTab;
  hostData: HostData;
}

const NO_HOST_TAB = 'Open an Atlas host in the active tab first.';

export async function findAtlasHostTab(): Promise<InspectedHostTab> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const activeTab = tabs.find((tab) => tab.active === true && isHostTab(tab));
  if (!activeTab || !isHostTab(activeTab)) throw new Error(NO_HOST_TAB);
  if (isExtensionPageUrl(activeTab.url)) {
    return firstInspectable(recentWebTabs(tabs, activeTab.id), NO_HOST_TAB);
  }
  if (!isWebPageUrl(activeTab.url)) throw new Error(NO_HOST_TAB);

  try {
    return { tab: activeTab, hostData: await inspectTab(activeTab) };
  } catch (error) {
    if (!isLoopbackUrl(activeTab.url)) throw error;

    return findLocalPreview(tabs, activeTab.id, error);
  }
}

export async function requestArtifactVersion(
  tabId: number,
  artifactKey: string,
  versionKey: string,
): Promise<Manifest> {
  const response = await chrome.tabs.sendMessage(
    tabId,
    loadArtifactVersionRequest(artifactKey, versionKey),
  );
  if (!isManifestResponse(response))
    throw new Error(
      'Active page did not return the selected artifact version.',
    );
  if (!response.ok) throw new Error(response.error);

  return response.manifest;
}

export async function reloadHostTab(tabId: number): Promise<void> {
  await chrome.tabs.reload(tabId);
}

async function findLocalPreview(
  tabs: chrome.tabs.Tab[],
  activeTabId: number,
  activeTabError: unknown,
): Promise<InspectedHostTab> {
  const previews: InspectedHostTab[] = [];
  for (const tab of localPreviewTabs(tabs, activeTabId)) {
    try {
      previews.push({ tab, hostData: await inspectTab(tab) });
    } catch {
      continue;
    }
  }

  if (previews.length === 1) return previews[0]!;
  if (previews.length > 1)
    throw new Error(
      'Multiple local Atlas previews are open. Activate the intended App Preview tab, then open Columbus again.',
    );

  throw new Error(
    failureMessage(
      activeTabError,
      'inspect the active host page',
      'Open the Atlas App Preview URL printed by atlas dev, activate that browser tab, then reopen Columbus.',
    ),
  );
}

async function firstInspectable(
  tabs: HostTab[],
  failure: string,
): Promise<InspectedHostTab> {
  for (const tab of tabs) {
    try {
      return { tab, hostData: await inspectTab(tab) };
    } catch {
      continue;
    }
  }

  throw new Error(failure);
}

async function inspectTab(tab: HostTab): Promise<HostData> {
  const response = await chrome.tabs.sendMessage(
    tab.id,
    inspectHostRequest(OVERRIDE_DOCUMENT_KEY),
  );
  if (!isHostDataResponse(response))
    throw new Error('Active page did not return Atlas runtime information.');
  if (!response.ok) throw new Error(response.error);

  return response.hostData;
}

function localPreviewTabs(
  tabs: chrome.tabs.Tab[],
  activeTabId: number,
): HostTab[] {
  return otherTabsByRecency(tabs, activeTabId).filter((tab) =>
    isLoopbackUrl(tab.url),
  );
}

function recentWebTabs(
  tabs: chrome.tabs.Tab[],
  activeTabId: number,
): HostTab[] {
  return otherTabsByRecency(tabs, activeTabId).filter((tab) =>
    isWebPageUrl(tab.url),
  );
}

function otherTabsByRecency(
  tabs: chrome.tabs.Tab[],
  activeTabId: number,
): HostTab[] {
  return tabs
    .filter((tab): tab is HostTab => isHostTab(tab) && tab.id !== activeTabId)
    .sort(
      (left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0),
    );
}

function isHostTab(tab: chrome.tabs.Tab): tab is HostTab {
  return typeof tab.id === 'number' && typeof tab.url === 'string';
}
