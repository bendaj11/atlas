import { BADGE_BACKGROUND_COLOR, BADGE_TEXT_COLOR } from "./popup/constants.js";

interface BadgeCountMessage {
  type: "atlas.override-count";
  overrideCount: number;
}

chrome.runtime.onInstalled.addListener(() => undefined);
chrome.runtime.onMessage.addListener((message, sender) => {
  if (!isBadgeCountMessage(message) || typeof sender.tab?.id !== "number") return;
  void updateActionBadge(sender.tab.id, message.overrideCount);
});

async function updateActionBadge(tabId: number, overrideCount: number): Promise<void> {
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_BACKGROUND_COLOR });
  await chrome.action.setBadgeTextColor?.({ color: BADGE_TEXT_COLOR });
  await chrome.action.setBadgeText({ tabId, text: overrideCount > 0 ? String(overrideCount) : "" });
}

function isBadgeCountMessage(message: unknown): message is BadgeCountMessage {
  if (typeof message !== "object" || message === null) return false;

  const value = message as Partial<BadgeCountMessage>;
  return value.type === "atlas.override-count"
    && Number.isInteger(value.overrideCount)
    && value.overrideCount! >= 0;
}
