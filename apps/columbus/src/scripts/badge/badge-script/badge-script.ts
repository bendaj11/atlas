import { mergeDevelopmentOffers } from '@atlas/schema';
import { createBadgeRefresher } from '../badge-refresh/badge-refresh';
import { hasAtlasBootstrapSignature } from '../atlas-bootstrap-signature/atlas-bootstrap-signature';
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
  persistedOverridesKey,
} from '../../../utils/storage-keys/storage-keys';
import {
  countOverrides,
  isStoredOverrideDocument,
} from '../../../utils/override-document/override-document';
import { readDevelopmentOffers } from '../../../utils/development-offers/development-offers';
import type { DevelopmentOffers } from '../../../types/host-data';
import { createArtifactRegistry } from '../../../utils/artifact-registry/artifact-registry';
import { inspectAtlasHost } from '../../../utils/inspect-atlas-host/inspect-atlas-host';
import {
  readDismissedOfferIds,
  readRuntimeErrors,
  readVisibleAppIds,
} from '../../../utils/page-runtime-state/page-runtime-state';

const REFRESH_INTERVAL_MS = 2_000;
const darkColorScheme = window.matchMedia('(prefers-color-scheme: dark)');
const artifactRegistry = createArtifactRegistry();
let runtimeConfigPromise: Promise<{ hostId?: string } | undefined> | undefined;
let developmentOffers: DevelopmentOffers | undefined;

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
  const config = await readRuntimeConfig();
  const hostId = config?.hostId;

  if (!hostId) return stored ? countStoredOverrides(parseJson(stored)) : 0;

  const document = stored
    ? parseJson(stored)
    : (await chrome.storage.local.get(persistedOverridesKey(hostId)))[
        persistedOverridesKey(hostId)
      ];
  const selection = isStoredOverrideDocument(document)
    ? {
        overrides: document.overrides,
        ...(document.hostOverride
          ? { hostOverride: document.hostOverride }
          : {}),
      }
    : { overrides: [] };
  developmentOffers ??= await readDevelopmentOffers(hostId);

  return countOverrides(
    developmentOffers
      ? mergeDevelopmentOffers({
          selection,
          offers: developmentOffers,
          dismissedOfferIds: readDismissedOfferIds(hostId),
        })
      : selection,
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
  return isStoredOverrideDocument(value) ? countOverrides(value) : 0;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
