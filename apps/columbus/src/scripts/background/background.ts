import {
  BADGE_BACKGROUND_COLOR,
  BADGE_TEXT_COLOR,
} from '../../utils/constants/constants';
import { CONTROL_PORT_PARAMETER } from '../../utils/control-port/control-port';
import { clearHostDataCache } from '../../utils/host-data-cache/host-data-cache';
import { actionIconPathsFor } from '../../utils/action-icon-theme/action-icon-theme';
import { messageFromError } from '../../utils/errors/errors';
import { focusPreviewTab } from '../../utils/preview-tabs/preview-tabs';
import {
  isActionThemeMessage,
  isFocusPreviewRequest,
  isLoadDevelopmentSessionRequest,
  isOverrideCountMessage,
  isRecord,
  type LoadDevelopmentSessionRequest,
} from '../../utils/messages/messages';
import { loadDevelopmentSession } from '../development-session/development-session-background/development-session-background';

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') void clearHostDataCache(tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => void clearHostDataCache(tabId));
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (isLoadDevelopmentSessionRequest(message)) {
    void loadForTab(sender, message).then(
      (document) => sendResponse({ document }),
      (error) => sendResponse({ error: messageFromError(error) }),
    );

    return true;
  }

  if (isFocusPreviewRequest(message) && sender.tab) {
    void focusPreviewTab({ launcherTab: sender.tab }).then(
      (focused) => sendResponse({ focused }),
      () => sendResponse({ focused: false }),
    );

    return true;
  }

  if (isActionThemeMessage(message)) {
    void chrome.action.setIcon({
      path: actionIconPathsFor(message.colorScheme),
    });

    return;
  }

  if (isOverrideCountMessage(message) && typeof sender.tab?.id === 'number') {
    void updateActionBadge(sender.tab.id, message.overrideCount);
  }
});

async function loadForTab(
  sender: { tab?: chrome.tabs.Tab; url?: string },
  request: LoadDevelopmentSessionRequest,
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
    const body: unknown = await response.json().catch(() => undefined);
    throw new Error(
      isRecord(body) && typeof body.error === 'string'
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

function previewIdentity(value: string): string {
  const url = new URL(value);
  url.searchParams.delete(CONTROL_PORT_PARAMETER);

  return url.href;
}
