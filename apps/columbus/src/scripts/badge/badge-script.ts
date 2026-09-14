import {
  countDevSessionOverrides,
  createBadgeRefresher,
} from './badge-refresh/badge-refresh';
import { hasAtlasBootstrapSignature } from './atlas-bootstrap-signature';
import { messageFromError } from '../shared/errors/errors';
import {
  actionThemeMessage,
  isInspectHostRequest,
  isLoadArtifactVersionRequest,
  isRecord,
  overrideCountMessage,
} from '../shared/messages/messages';
import {
  OVERRIDE_DOCUMENT_KEY,
  disabledLocalAppsKey,
  persistedOverridesKey,
} from '../shared/storage-keys/storage-keys';
import { isLoopbackHostname } from '../shared/urls/urls';
import { countOverrides } from '../overrides/override-document/override-document';
import { createArtifactRegistry } from '../host/artifact-registry/artifact-registry';
import { inspectAtlasHost } from '../host/inspect-atlas-host/inspect-atlas-host';

const DEV_SESSION_URL = 'http://localhost:4400/atlas.dev-session.json';
const REFRESH_INTERVAL_MS = 2_000;
const darkColorScheme = window.matchMedia('(prefers-color-scheme: dark)');
const artifactRegistry = createArtifactRegistry();
let atlasConfigPromise: Promise<{ hostId?: string } | undefined> | undefined;

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
  if (await readAtlasConfig()) {
    window.setInterval(() => void refreshBadge(), REFRESH_INTERVAL_MS);
  }
}

async function readOverrideCount(): Promise<number> {
  const stored =
    sessionStorage.getItem(OVERRIDE_DOCUMENT_KEY) ??
    localStorage.getItem(OVERRIDE_DOCUMENT_KEY);
  if (stored) return storedOverrideCount(stored);

  const config = await readAtlasConfig();
  if (!config?.hostId) return 0;

  if (isLoopbackHostname(location.hostname)) {
    const devOverrideCount = await readDevOverrideCount(config.hostId);
    if (devOverrideCount !== undefined) return devOverrideCount;
  }

  const key = persistedOverridesKey(config.hostId);
  const persisted = await chrome.storage.local.get(key);

  return storedOverrideCount(persisted[key]);
}

async function readDevOverrideCount(
  hostId: string,
): Promise<number | undefined> {
  try {
    const url = new URL(DEV_SESSION_URL);
    url.searchParams.set('hostId', hostId);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return undefined;

    const session = (await response.json()) as {
      schemaVersion?: string;
      hostId?: string;
      overrides?: unknown[];
      hostOverride?: unknown;
    };
    if (
      session.schemaVersion !== '1' ||
      session.hostId !== hostId ||
      !Array.isArray(session.overrides)
    )
      return undefined;
    const disabledAppIds = readBadgeDisabledAppIds(hostId);
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

function readBadgeDisabledAppIds(hostId: string): Set<string> {
  const key = disabledLocalAppsKey(hostId);
  const stored = sessionStorage.getItem(key) ?? localStorage.getItem(key);
  const value = stored ? parseJson(stored) : [];
  return new Set(
    Array.isArray(value)
      ? value.filter((appId): appId is string => typeof appId === 'string')
      : [],
  );
}

async function readAtlasConfig(): Promise<{ hostId?: string } | undefined> {
  atlasConfigPromise ??= fetchAtlasConfig();
  return atlasConfigPromise;
}

async function fetchAtlasConfig(): Promise<{ hostId?: string } | undefined> {
  if (!hasAtlasBootstrapSignature(document)) return undefined;

  try {
    const response = await fetch('/atlas.runtime.json', {
      cache: 'no-store',
    });
    if (!response.ok) return undefined;

    const value = (await response.json()) as {
      schemaVersion?: string;
      hostId?: string;
    };
    return value.schemaVersion === 'v1' ? value : undefined;
  } catch {
    return undefined;
  }
}

function storedOverrideCount(value: unknown): number {
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
