import {
  countDevSessionOverrides,
  createBadgeRefresher,
} from '../badge-refresh/badge-refresh';
import { hasAtlasBootstrapSignature } from '../atlas-bootstrap-signature/atlas-bootstrap-signature';
import {
  DEFAULT_CONTROL_PORT,
  rememberedControlPort,
} from '../../../utils/control-port/control-port';
import { messageFromError } from '../../../utils/errors/errors';
import {
  actionThemeMessage,
  isInspectHostRequest,
  isLoadArtifactVersionRequest,
  isReadPageStateRequest,
  isRecord,
  overrideCountMessage,
} from '../../../utils/messages/messages';
import {
  OVERRIDE_DOCUMENT_KEY,
  disabledLocalAppsKey,
  persistedOverridesKey,
} from '../../../utils/storage-keys/storage-keys';
import { isLoopbackHostname } from '../../../utils/urls/urls';
import { countOverrides } from '../../../utils/override-document/override-document';
import { createArtifactRegistry } from '../../../utils/artifact-registry/artifact-registry';
import { inspectAtlasHost } from '../../../utils/inspect-atlas-host/inspect-atlas-host';
import {
  readRuntimeErrors,
  readVisibleAppIds,
} from '../../../utils/page-runtime-state/page-runtime-state';

const REFRESH_INTERVAL_MS = 2_000;
const darkColorScheme = window.matchMedia('(prefers-color-scheme: dark)');
const artifactRegistry = createArtifactRegistry();
let runtimeConfigPromise: Promise<{ hostId?: string } | undefined> | undefined;

const refreshBadge = createBadgeRefresher({
  readCount: readOverrideCount,
  publishCount: async (overrideCount) => {
    await chrome.runtime.sendMessage(overrideCountMessage(overrideCount));
  },
});

void startBadgeRefresh();
void publishActionTheme();
window.addEventListener('focus', () => void refreshBadge());
window.addEventListener('pageshow', () => void refreshBadge());
window.addEventListener('storage', () => void refreshBadge());
darkColorScheme.addEventListener('change', () => void publishActionTheme());
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isInspectHostRequest(message)) {
    void inspectAtlasHost(message.documentKey, artifactRegistry).then(
      (hostData) => sendResponse({ ok: true, hostData }),
      (error) => sendResponse({ ok: false, error: messageFromError(error) }),
    );

    return true;
  }
  if (isReadPageStateRequest(message)) {
    sendResponse({
      ok: true,
      pageState: {
        visibleAppIds: readVisibleAppIds(),
        runtimeErrors: readRuntimeErrors(),
      },
    });

    return false;
  }
  if (isLoadArtifactVersionRequest(message)) {
    void artifactRegistry
      .loadVersion(message.artifactKey, message.versionKey)
      .then(
        (manifest) => sendResponse({ ok: true, manifest }),
        (error) => sendResponse({ ok: false, error: messageFromError(error) }),
      );

    return true;
  }

  return false;
});

async function publishActionTheme(): Promise<void> {
  await chrome.runtime.sendMessage(
    actionThemeMessage(darkColorScheme.matches ? 'dark' : 'light'),
  );
}

async function startBadgeRefresh(): Promise<void> {
  await refreshBadge();
  if (await readRuntimeConfig()) {
    window.setInterval(() => void refreshBadge(), REFRESH_INTERVAL_MS);
  }
}

async function readOverrideCount(): Promise<number> {
  const stored =
    sessionStorage.getItem(OVERRIDE_DOCUMENT_KEY) ??
    localStorage.getItem(OVERRIDE_DOCUMENT_KEY);
  if (stored) return countStoredOverrides(stored);

  const config = await readRuntimeConfig();
  if (!config?.hostId) return 0;

  if (isLoopbackHostname(location.hostname)) {
    const developmentSessionOverrideCount =
      await readDevelopmentSessionOverrideCount(config.hostId);
    if (developmentSessionOverrideCount !== undefined)
      return developmentSessionOverrideCount;
  }

  const key = persistedOverridesKey(config.hostId);
  const persisted = await chrome.storage.local.get(key);

  return countStoredOverrides(persisted[key]);
}

async function readDevelopmentSessionOverrideCount(
  hostId: string,
): Promise<number | undefined> {
  try {
    const url = new URL(
      '/atlas.dev-session.json',
      `http://localhost:${rememberedControlPort() ?? DEFAULT_CONTROL_PORT}`,
    );
    url.searchParams.set('hostId', hostId);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return undefined;

    const session: unknown = await response.json();
    if (
      !isRecord(session) ||
      session.schemaVersion !== '1' ||
      session.hostId !== hostId ||
      !Array.isArray(session.overrides)
    )
      return undefined;
    const disabledAppIds = readDisabledLocalAppIds(hostId);

    return countDevSessionOverrides({
      session: {
        overrides: session.overrides,
        hostOverride: session.hostOverride,
      },
      disabledAppIds,
    });
  } catch {
    return undefined;
  }
}

function readDisabledLocalAppIds(hostId: string): Set<string> {
  const key = disabledLocalAppsKey(hostId);
  const stored = sessionStorage.getItem(key) ?? localStorage.getItem(key);
  const value = stored ? parseJson(stored) : [];

  return new Set(
    Array.isArray(value)
      ? value.filter((appId): appId is string => typeof appId === 'string')
      : [],
  );
}

async function readRuntimeConfig(): Promise<{ hostId?: string } | undefined> {
  runtimeConfigPromise ??= fetchRuntimeConfig();

  return runtimeConfigPromise;
}

async function fetchRuntimeConfig(): Promise<{ hostId?: string } | undefined> {
  if (!hasAtlasBootstrapSignature(document)) return undefined;

  try {
    const response = await fetch('/atlas.runtime.json', {
      cache: 'no-store',
    });
    if (!response.ok) return undefined;

    const value: unknown = await response.json();
    if (!isRecord(value) || value.schemaVersion !== 'v1') return undefined;

    return typeof value.hostId === 'string' ? { hostId: value.hostId } : {};
  } catch {
    return undefined;
  }
}

function countStoredOverrides(value: unknown): number {
  const documentValue = typeof value === 'string' ? parseJson(value) : value;
  if (!isRecord(documentValue) || !Array.isArray(documentValue.overrides))
    return 0;

  return countOverrides({
    overrides: documentValue.overrides,
    hostOverride: documentValue.hostOverride,
  });
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
