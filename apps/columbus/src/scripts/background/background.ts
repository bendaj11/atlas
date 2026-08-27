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
  loadDevelopmentSession,
  type DevelopmentSessionRequest,
} from '../development-session/development-session-background.js';

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
  if (isDevelopmentSessionMessage(message)) {
    void loadForTab(sender, message).then(
      (document) => sendResponse({ document }),
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

async function loadForTab(
  sender: { tab?: chrome.tabs.Tab; url?: string },
  request: DevelopmentSessionRequest,
): Promise<unknown> {
  const senderUrl = sender.url ?? sender.tab?.url;
  if (sender.tab?.id === undefined || !senderUrl) {
    throw new Error('Atlas development session requires a browser tab.');
  }
  if (previewIdentity(senderUrl) !== previewIdentity(request.previewUrl)) {
    throw new Error('Atlas development preview URL does not match its tab.');
  }
  return loadDevelopmentSession(request, {
    fetchJson: fetchDevelopmentSession,
  });
}

async function fetchDevelopmentSession(url: string): Promise<unknown> {
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as
      { error?: unknown } | undefined;
    throw new Error(
      typeof body?.error === 'string'
        ? body.error
        : `Atlas development session returned HTTP ${response.status}.`,
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

function isDevelopmentSessionMessage(
  value: unknown,
): value is DevelopmentSessionRequest & {
  type: 'atlas.load-development-session';
} {
  return (
    isMessage(value, 'atlas.load-development-session') &&
    typeof (value as { hostId?: unknown }).hostId === 'string' &&
    typeof (value as { previewUrl?: unknown }).previewUrl === 'string' &&
    ((value as { controlPort?: unknown }).controlPort === undefined ||
      typeof (value as { controlPort?: unknown }).controlPort === 'number')
  );
}

function previewIdentity(value: string): string {
  const url = new URL(value);
  url.searchParams.delete('atlas-dev-port');
  return url.href;
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
