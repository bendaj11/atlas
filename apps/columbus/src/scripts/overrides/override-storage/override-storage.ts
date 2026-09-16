import type { ArtifactVersion } from '../../../types/artifact-version';
import type { HostData } from '../../../types/host-data';
import type { AtlasOverrideDocument as OverrideDocument } from '../../../types/override-document';
import { getArtifactKey } from '../../artifact-versions/artifact-version-keys/artifact-version-keys';
import type { Scope } from '../../../types/columbus-state';
import { normalizeStoredArtifactVersion } from '../../artifact-versions/artifact-version-utils/artifact-version-utils';
import {
  OVERRIDE_DOCUMENT_KEY,
  disabledLocalAppsKey,
  disabledOverridesKey,
  persistedOverridesKey,
  suppressedArtifactsKey,
} from '../../shared/storage-keys/storage-keys';
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
  disabledAppIds?: string[];
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
  disabledAppIds = [],
}: WriteOverrideDocumentOptions): Promise<void> {
  const hostId = hostData.config.hostId;

  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: persistOverridesInPage,
    args: [
      OVERRIDE_DOCUMENT_KEY,
      disabledLocalAppsKey(hostId),
      JSON.stringify({ documentValue, scope, disabledAppIds }),
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

      return [getArtifactKey(normalized), normalized];
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

export async function readClearedLocalArtifactIds(
  location: OverrideStorageLocation,
): Promise<Set<string>> {
  const key = suppressedArtifactsKey(
    location.hostId,
    location.tabId,
    location.scope,
  );
  const stored = await chrome.storage.local.get(key);
  const value = stored[key];

  return new Set(
    Array.isArray(value)
      ? value.filter(
          (artifactId): artifactId is string =>
            typeof artifactId === 'string' && artifactId.length > 0,
        )
      : [],
  );
}

export async function writeClearedLocalArtifactIds(
  location: OverrideStorageLocation,
  artifactIds: Set<string>,
): Promise<void> {
  await writeList(
    suppressedArtifactsKey(location.hostId, location.tabId, location.scope),
    [...artifactIds],
  );
}

async function writeList(key: string, values: unknown[]): Promise<void> {
  if (values.length === 0) {
    await chrome.storage.local.remove(key);

    return;
  }
  await chrome.storage.local.set({ [key]: values });
}

function persistOverridesInPage(
  documentKey: string,
  disabledAppsKey: string,
  payload: string,
): void {
  const { documentValue, scope, disabledAppIds } = JSON.parse(payload) as {
    documentValue: OverrideDocument;
    scope: Scope;
    disabledAppIds: string[];
  };
  const serializedDocument = JSON.stringify(documentValue);
  const serializedDisabledApps = JSON.stringify(disabledAppIds);
  const hasOverrides =
    documentValue.overrides.length + (documentValue.hostOverride ? 1 : 0) > 0;

  if (scope !== 'all') {
    sessionStorage.setItem(documentKey, serializedDocument);
    sessionStorage.setItem(disabledAppsKey, serializedDisabledApps);

    return;
  }

  if (hasOverrides || disabledAppIds.length > 0)
    localStorage.setItem(documentKey, serializedDocument);
  else localStorage.removeItem(documentKey);
  sessionStorage.removeItem(documentKey);

  if (disabledAppIds.length > 0)
    localStorage.setItem(disabledAppsKey, serializedDisabledApps);
  else localStorage.removeItem(disabledAppsKey);
  sessionStorage.removeItem(disabledAppsKey);
}
