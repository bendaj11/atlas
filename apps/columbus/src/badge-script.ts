import {
  countDevSessionOverrides,
  createBadgeRefresher,
} from './badge-refresh.js';

const DOCUMENT_KEY = "atlas.runtime-overrides";
const DEV_SESSION_URL = "http://localhost:4400/atlas.dev-session.json";
const BADGE_DISABLED_LOCAL_APPS_KEY_PREFIX = "atlas.disabled-local-apps.";
const REFRESH_INTERVAL_MS = 2_000;
let atlasConfigPromise: Promise<{
  hostId?: string;
  allowCustomOverrides?: boolean;
} | undefined> | undefined;

const refreshBadge = createBadgeRefresher({
  readCount: readOverrideCount,
  publishCount: async (overrideCount) => {
    await chrome.runtime.sendMessage({ type: "atlas.override-count", overrideCount });
  }
});

void startBadgeRefresh();
window.addEventListener("focus", () => void refreshBadge());
window.addEventListener("pageshow", () => void refreshBadge());
window.addEventListener("storage", () => void refreshBadge());

async function startBadgeRefresh(): Promise<void> {
  await refreshBadge();
  if (await readAtlasConfig()) {
    window.setInterval(() => void refreshBadge(), REFRESH_INTERVAL_MS);
  }
}

async function readOverrideCount(): Promise<number> {
  const stored = sessionStorage.getItem(DOCUMENT_KEY) ?? localStorage.getItem(DOCUMENT_KEY);
  if (stored) return overrideCount(stored);

  const config = await readAtlasConfig();
  if (!config?.hostId) return 0;

  if (config.allowCustomOverrides === true && isLoopbackBadgeHost(location.hostname)) {
    const devOverrideCount = await readDevOverrideCount(config.hostId);
    if (devOverrideCount !== undefined) return devOverrideCount;
  }

  const key = `atlas.overrides.${config.hostId}`;
  const persisted = await chrome.storage.local.get(key);
  return overrideCount(persisted[key]);
}

function isLoopbackBadgeHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

async function readDevOverrideCount(hostId: string): Promise<number | undefined> {
  try {
    const url = new URL(DEV_SESSION_URL);
    url.searchParams.set("hostId", hostId);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return undefined;

    const session = await response.json() as {
      schemaVersion?: string;
      hostId?: string;
      overrides?: unknown[];
      hostOverride?: unknown;
    };
    if (session.schemaVersion !== "1" || session.hostId !== hostId || !Array.isArray(session.overrides)) return undefined;
    const disabledAppIds = readBadgeDisabledAppIds(hostId);
    return countDevSessionOverrides(
      { overrides: session.overrides, hostOverride: session.hostOverride },
      disabledAppIds
    );
  } catch {
    return undefined;
  }
}

function readBadgeDisabledAppIds(hostId: string): Set<string> {
  const key = `${BADGE_DISABLED_LOCAL_APPS_KEY_PREFIX}${hostId}`;
  const stored = sessionStorage.getItem(key) ?? localStorage.getItem(key);
  const value = stored ? parseJson(stored) : [];
  return new Set(Array.isArray(value) ? value.filter((appId): appId is string => typeof appId === "string") : []);
}

async function readAtlasConfig(): Promise<{
  hostId?: string;
  allowCustomOverrides?: boolean;
} | undefined> {
  atlasConfigPromise ??= fetchAtlasConfig();
  return atlasConfigPromise;
}

async function fetchAtlasConfig(): Promise<{
  hostId?: string;
  allowCustomOverrides?: boolean;
} | undefined> {
  try {
    const response = await fetch("/atlas.runtime.json", { cache: "no-store" });
    if (!response.ok) return undefined;

    const value = await response.json() as {
      schemaVersion?: string;
      hostId?: string;
      allowCustomOverrides?: boolean;
    };
    return value.schemaVersion === "1" ? value : undefined;
  } catch {
    return undefined;
  }
}

function overrideCount(value: unknown): number {
  const documentValue = typeof value === "string" ? parseJson(value) : value;
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

function isOverrideDocument(value: unknown): value is { overrides: unknown[]; hostOverride?: unknown } {
  return typeof value === "object"
    && value !== null
    && "overrides" in value
    && Array.isArray(value.overrides);
}
