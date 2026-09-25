import { ATLAS_PREVIEW_LAUNCHER_MARKER } from '@atlas/schema';
import {
  focusPreviewRequest,
  isRecord,
} from '../../../utils/messages/messages';
import { launchedPreviewUrl } from '../../../utils/preview-tabs/preview-tabs';

const previewUrl = launchedPreviewUrl(location.href);

if (previewUrl) {
  markLauncherHandled();
  void chrome.runtime.sendMessage(focusPreviewRequest()).then(
    (response: unknown) => {
      if (!isRecord(response) || response.focused !== true)
        location.replace(previewUrl);
    },
    () => location.replace(previewUrl),
  );
}

function markLauncherHandled(): void {
  const mark = (): boolean => {
    if (!document.documentElement) return false;
    document.documentElement.setAttribute(ATLAS_PREVIEW_LAUNCHER_MARKER, '');

    return true;
  };
  if (mark()) return;

  const observer = new MutationObserver(() => {
    if (!mark()) return;
    observer.disconnect();
  });
  observer.observe(document, { childList: true });
}
