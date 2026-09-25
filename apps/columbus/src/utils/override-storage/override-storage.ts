import {
  dismissedDevelopmentOffersKey,
  type AtlasDevelopmentOfferIds,
} from '@atlas/schema';
import type { ArtifactVersion } from '../../types/artifact-version';
import type { HostData } from '../../types/host-data';
import type { AtlasOverrideDocument as OverrideDocument } from '../../types/override-document';
import type { Scope } from '../../types/columbus-state';
import { normalizeStoredArtifactVersion } from '../artifact-version-utils/artifact-version-utils';
import {
  OVERRIDE_DOCUMENT_KEY,
  disabledOverridesKey,
  persistedOverridesKey,
} from '../storage-keys/storage-keys';
import {
  countOverrides,
  isStoredManifest,
  isStoredOverrideDocument,
} from '../override-document/override-document';

export interface OverrideStorageLocation {
  hostId: string;
  tabId: number;
  scope: Scope;
}

interface WriteOverrideDocumentOptions {
  tabId: number;
  hostData: HostData;
  documentValue: OverrideDocument;
  scope: Scope;
  dismissedOfferIds: AtlasDevelopmentOfferIds;
}

export async function readPersistedOverrideDocument(
  hostData: HostData,
): Promise<OverrideDocument | undefined> {
  const key = persistedOverridesKey(hostData.config.hostId);
  const persisted = await chrome.storage.local.get(key);
  const value = persisted[key];

  return isStoredOverrideDocument(value) &&
    value.hostId === hostData.config.hostId
    ? value
    : undefined;
}

export async function writeOverrideDocument({
  tabId,
  hostData,
  documentValue,
  scope,
  dismissedOfferIds,
}: WriteOverrideDocumentOptions): Promise<void> {
  const hostId = hostData.config.hostId;

  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: persistOverridesInPage,
    args: [
      OVERRIDE_DOCUMENT_KEY,
      dismissedDevelopmentOffersKey(hostId),
      { documentValue, scope, dismissedOfferIds },
    ],
  });
  if (scope !== 'all') return;

  const key = persistedOverridesKey(hostId);
  if (countOverrides(documentValue))
    await chrome.storage.local.set({ [key]: documentValue });
  else await chrome.storage.local.remove(key);
}

export async function readDisabledArtifactVersionOverrides(
  location: OverrideStorageLocation,
): Promise<Map<string, ArtifactVersion>> {
  const key = disabledOverridesKey(
    location.hostId,
    location.tabId,
    location.scope,
  );
  const stored = await chrome.storage.local.get(key);
  const value = stored[key];
  const artifactVersions = Array.isArray(value)
    ? value.filter(isStoredManifest)
    : [];

  return new Map(
    artifactVersions.map((artifactVersion) => {
      const normalized = normalizeStoredArtifactVersion(artifactVersion);

      return [normalized.id, normalized];
    }),
  );
}

export async function writeDisabledArtifactVersionOverrides(
  location: OverrideStorageLocation,
  overrides: Map<string, ArtifactVersion>,
): Promise<void> {
  await writeList(
    disabledOverridesKey(location.hostId, location.tabId, location.scope),
    [...overrides.values()],
  );
}

async function writeList(key: string, values: unknown[]): Promise<void> {
  if (values.length === 0) {
    await chrome.storage.local.remove(key);

    return;
  }
  await chrome.storage.local.set({ [key]: values });
}

interface PersistedOverridesPayload {
  documentValue: OverrideDocument;
  scope: Scope;
  dismissedOfferIds: AtlasDevelopmentOfferIds;
}

function persistOverridesInPage(
  documentKey: string,
  dismissedOffersKey: string,
  { documentValue, scope, dismissedOfferIds }: PersistedOverridesPayload,
): void {
  const serializedDocument = JSON.stringify(documentValue);
  const serializedDismissedOffers = JSON.stringify(dismissedOfferIds);
  const hasOverrides =
    documentValue.overrides.length + (documentValue.hostOverride ? 1 : 0) > 0;
  const hasDismissedOffers = Object.keys(dismissedOfferIds).length > 0;

  if (scope !== 'all') {
    sessionStorage.setItem(documentKey, serializedDocument);
    sessionStorage.setItem(dismissedOffersKey, serializedDismissedOffers);

    return;
  }

  if (hasOverrides || hasDismissedOffers)
    localStorage.setItem(documentKey, serializedDocument);
  else localStorage.removeItem(documentKey);
  sessionStorage.removeItem(documentKey);

  if (hasDismissedOffers)
    localStorage.setItem(dismissedOffersKey, serializedDismissedOffers);
  else localStorage.removeItem(dismissedOffersKey);
  sessionStorage.removeItem(dismissedOffersKey);
}
