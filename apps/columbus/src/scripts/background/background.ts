import {
  BADGE_BACKGROUND_COLOR,
  BADGE_TEXT_COLOR,
} from '../shared/constants.js';
import { clearHostDataCache } from '../host/host-data-cache.js';
import {
  actionIconPathsFor,
  isActionThemeMessage,
} from '../shared/action-icon-theme.js';
import {
  activateDevelopmentPreview,
  consumeDevelopmentSession,
} from '../development-session/development-session-background.js';
import { ATLAS_DEV_ACTIVATION_PROTOCOL_VERSION } from '@atlas/schema';

interface BadgeCountMessage {
  type: 'atlas.override-count';
  overrideCount: number;
}

chrome.runtime.onInstalled.addListener(() => undefined);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') void clearHostDataCache(tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => void clearHostDataCache(tabId));
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (isActivateDevelopmentPreviewMessage(message)) {
    void activateFromTab(sender).then(
      () => sendResponse({}),
      (error) => sendResponse({ error: messageFromError(error) }),
    );
    return true;
  }

  if (isConsumeDevelopmentSessionMessage(message)) {
    void consumeForTab(sender, message.hostId).then(
      (document) => sendResponse(document === undefined ? {} : { document }),
      (error) => sendResponse({ error: messageFromError(error) }),
    );
    return true;
  }

  if (isActionThemeMessage(message)) {
    void chrome.action.setIcon({
      path: actionIconPathsFor(message.colorScheme),
    });
    return;
  }

  if (isBadgeCountMessage(message) && typeof sender.tab?.id === 'number') {
    void updateActionBadge(sender.tab.id, message.overrideCount);
  }
});

async function activateFromTab(sender: {
  tab?: chrome.tabs.Tab;
  url?: string;
}): Promise<void> {
  const tabId = sender.tab?.id;
  const senderUrl = sender.url ?? sender.tab?.url;
  if (tabId === undefined || !senderUrl) {
    throw new Error('Atlas development activation requires a browser tab.');
  }

  await activateDevelopmentPreview(senderUrl, tabId, {
    consumeActivation: fetchDevelopmentActivation,
    now: Date.now,
    store: async (key, value) => chrome.storage.session.set({ [key]: value }),
    navigate: async (id, url) => {
      await chrome.tabs.update(id, { url });
    },
  });
}

async function consumeForTab(
  sender: { tab?: chrome.tabs.Tab; url?: string },
  hostId: string,
): Promise<unknown | undefined> {
  const tabId = sender.tab?.id;
  const senderUrl = sender.url ?? sender.tab?.url;
  if (tabId === undefined || !senderUrl) return undefined;

  return consumeDevelopmentSession(senderUrl, tabId, hostId, {
    now: Date.now,
    read: async (key) => (await chrome.storage.session.get(key))[key],
    remove: async (key) => chrome.storage.session.remove(key),
  });
}

async function fetchDevelopmentActivation(url: string): Promise<unknown> {
  const response = await fetch(url, {
    cache: 'no-store',
    method: 'POST',
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as
      { error?: unknown } | undefined;
    throw new Error(
      typeof body?.error === 'string'
        ? body.error
        : `Atlas development activation returned HTTP ${response.status}.`,
    );
  }
  return response.json();
}

async function updateActionBadge(
  tabId: number,
  overrideCount: number,
): Promise<void> {
  await chrome.action.setBadgeBackgroundColor({
    color: BADGE_BACKGROUND_COLOR,
  });
  await chrome.action.setBadgeTextColor?.({ color: BADGE_TEXT_COLOR });
  await chrome.action.setBadgeText({
    tabId,
    text: overrideCount > 0 ? String(overrideCount) : '',
  });
}

function isBadgeCountMessage(message: unknown): message is BadgeCountMessage {
  if (typeof message !== 'object' || message === null) return false;

  const value = message as Partial<BadgeCountMessage>;
  return (
    value.type === 'atlas.override-count' &&
    Number.isInteger(value.overrideCount) &&
    value.overrideCount! >= 0
  );
}

function isActivateDevelopmentPreviewMessage(value: unknown): value is {
  type: 'atlas.activate-development-preview';
  protocolVersion: string;
} {
  return (
    isMessage(value, 'atlas.activate-development-preview') &&
    (value as { protocolVersion?: unknown }).protocolVersion ===
      ATLAS_DEV_ACTIVATION_PROTOCOL_VERSION
  );
}

function isConsumeDevelopmentSessionMessage(
  value: unknown,
): value is { type: 'atlas.consume-development-session'; hostId: string } {
  return (
    isMessage(value, 'atlas.consume-development-session') &&
    typeof (value as { hostId?: unknown }).hostId === 'string'
  );
}

function isMessage(value: unknown, type: string): value is { type: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === type
  );
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
