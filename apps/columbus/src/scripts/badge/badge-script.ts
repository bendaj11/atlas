import {
  countDevSessionOverrides,
  createBadgeRefresher,
} from './badge-refresh/badge-refresh.js';
import { hasAtlasBootstrapSignature } from './atlas-bootstrap-signature.js';
import { inspectAtlasHost } from '../host/inspect-atlas-host/inspect-atlas-host.js';

const DOCUMENT_KEY = 'atlas.runtime-overrides';
const DEV_SESSION_URL = 'http://localhost:4400/atlas.dev-session.json';
const BADGE_DISABLED_LOCAL_APPS_KEY_PREFIX = 'atlas.disabled-local-apps.';
const REFRESH_INTERVAL_MS = 2_000;
const darkColorScheme = window.matchMedia('(prefers-color-scheme: dark)');
let atlasConfigPromise: Promise<{ hostId?: string } | undefined> | undefined;

const refreshBadge = createBadgeRefresher({
  readCount: readOverrideCount,
  publishCount: async (overrideCount) => {
    await chrome.runtime.sendMessage({
      type: 'atlas.override-count',
      overrideCount,
    });
  },
});

void startBadgeRefresh();
void publishActionTheme();
window.addEventListener('focus', () => void refreshBadge());
window.addEventListener('pageshow', () => void refreshBadge());
window.addEventListener('storage', () => void refreshBadge());
darkColorScheme.addEventListener('change', () => void publishActionTheme());
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isInspectionRequest(message)) return;
  void inspectAtlasHost(message.documentKey).then(
    (hostData) => sendResponse({ ok: true, hostData }),
    (error) => sendResponse({ ok: false, error: messageFromError(error) }),
  );
  return true;
});

function isInspectionRequest(
  value: unknown,
): value is { type: 'atlas.inspect-host'; documentKey: string } {
  if (typeof value !== 'object' || value === null) return false;
  const message = value as Record<string, unknown>;
  return (
    message.type === 'atlas.inspect-host' &&
    typeof message.documentKey === 'string'
  );
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function publishActionTheme(): Promise<void> {
  await chrome.runtime.sendMessage({
    type: 'columbus.action-theme',
    colorScheme: darkColorScheme.matches ? 'dark' : 'light',
  });
}

async function startBadgeRefresh(): Promise<void> {
  await refreshBadge();
  if (await readAtlasConfig()) {
    window.setInterval(() => void refreshBadge(), REFRESH_INTERVAL_MS);
  }
}

async function readOverrideCount(): Promise<number> {
  const stored =
    sessionStorage.getItem(DOCUMENT_KEY) ?? localStorage.getItem(DOCUMENT_KEY);
  if (stored) return overrideCount(stored);

  const config = await readAtlasConfig();
  if (!config?.hostId) return 0;

  if (isLoopbackBadgeHost(location.hostname)) {
    const devOverrideCount = await readDevOverrideCount(config.hostId);
    if (devOverrideCount !== undefined) return devOverrideCount;
  }

  const key = `atlas.overrides.${config.hostId}`;
  const persisted = await chrome.storage.local.get(key);
  return overrideCount(persisted[key]);
}

function isLoopbackBadgeHost(hostname: string): boolean {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
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
  const key = `${BADGE_DISABLED_LOCAL_APPS_KEY_PREFIX}${hostId}`;
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
    const response = await fetch('/atlas.bootstrap.json', {
      cache: 'no-store',
    });
    if (!response.ok) return undefined;

    const value = (await response.json()) as {
      schemaVersion?: string;
      hostId?: string;
    };
    return value.schemaVersion === '2' ? value : undefined;
  } catch {
    return undefined;
  }
}

function overrideCount(value: unknown): number {
  const documentValue = typeof value === 'string' ? parseJson(value) : value;
  if (!isOverrideDocument(documentValue)) return 0;

  return documentValue.overrides.length + (documentValue.hostOverride ? 1 : 0);
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function isOverrideDocument(
  value: unknown,
): value is { overrides: unknown[]; hostOverride?: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'overrides' in value &&
    Array.isArray(value.overrides)
  );
}
