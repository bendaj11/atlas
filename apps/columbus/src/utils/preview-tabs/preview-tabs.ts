import { ATLAS_PREVIEW_LAUNCHER_PATH } from '@atlas/schema';
import { isLoopbackUrl, isWebPageUrl } from '../urls/urls';

interface FocusPreviewTabOptions {
  launcherTab: chrome.tabs.Tab;
}

export function launchedPreviewUrl(
  launcherUrl: string | undefined,
): string | undefined {
  if (!isWebPageUrl(launcherUrl) || !isLoopbackUrl(launcherUrl))
    return undefined;

  const url = new URL(launcherUrl);
  const previewUrl = url.searchParams.get('previewUrl') ?? undefined;

  return url.pathname === ATLAS_PREVIEW_LAUNCHER_PATH &&
    isWebPageUrl(previewUrl)
    ? previewUrl
    : undefined;
}

export async function focusPreviewTab({
  launcherTab,
}: FocusPreviewTabOptions): Promise<boolean> {
  const previewUrl = launchedPreviewUrl(launcherTab.url);

  if (!previewUrl || launcherTab.id === undefined) return false;

  const previewTab = (await chrome.tabs.query({}))
    .filter(
      (tab) =>
        tab.id !== undefined &&
        tab.id !== launcherTab.id &&
        showsPreview({ tabUrl: tab.url, previewUrl }),
    )
    .sort(
      (first, second) => (second.lastAccessed ?? 0) - (first.lastAccessed ?? 0),
    )[0];

  if (previewTab?.id === undefined) return false;

  await chrome.tabs.update(previewTab.id, { active: true });
  if (previewTab.windowId !== undefined)
    await chrome.windows.update(previewTab.windowId, { focused: true });
  await chrome.tabs.reload(previewTab.id);
  await chrome.tabs.remove(launcherTab.id);

  return true;
}

function showsPreview({
  tabUrl,
  previewUrl,
}: {
  tabUrl: string | undefined;
  previewUrl: string;
}): boolean {
  if (!isWebPageUrl(tabUrl)) return false;

  const tab = new URL(tabUrl);
  const preview = new URL(previewUrl);

  const previewDirectory = preview.pathname.endsWith('/')
    ? preview.pathname
    : `${preview.pathname}/`;

  return (
    tab.origin === preview.origin &&
    (tab.pathname === preview.pathname ||
      tab.pathname.startsWith(previewDirectory))
  );
}
