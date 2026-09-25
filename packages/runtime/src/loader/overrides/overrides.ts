import { assertOverrideMatchesManifest } from '../catalog/catalog-resolution.js';
import { requestDevelopmentSession } from '../development-session/development-session.js';
import { AtlasOverrideError } from '../loader.errors.js';
import {
  dismissedDevelopmentOffersKey,
  isDevelopmentOfferIds,
  mergeDevelopmentOffers,
  parseDismissedDevelopmentOffers,
  type AtlasDevelopmentOffers,
  type AtlasRuntimeOverride,
  type AtlasRuntimeOverrideDocument,
} from '@atlas/schema';
import type {
  AtlasBrowserOverrideOptions,
  OverrideStorage,
} from './overrides.types.js';

export const ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY = 'atlas.runtime-overrides';

export async function loadBrowserRuntimeOverrides(
  options: AtlasBrowserOverrideOptions,
): Promise<AtlasRuntimeOverride[]> {
  const storages = [
    options.sessionStorage ?? globalThis.sessionStorage,
    options.localStorage ?? globalThis.localStorage,
  ];
  const requestSession =
    options.developmentSession ??
    (() => requestDevelopmentSession(options.hostId));
  const sessionValue = await requestSession();
  const offers = sessionValue
    ? parseDevelopmentOffersFromValue(sessionValue)
    : undefined;
  const stored = readOverrideDocumentFromStorage(storages);

  for (const document of [offers, stored])
    if (document) assertOverrideDocumentTargetsHost(document, options.hostId);

  const selection = { overrides: stored?.overrides ?? [] };
  const { overrides } = offers
    ? mergeDevelopmentOffers({
        selection,
        offers,
        dismissedOfferIds: parseDismissedDevelopmentOffers(
          readFromStorages({
            storages,
            key: dismissedDevelopmentOffersKey(options.hostId),
          }),
        ),
      })
    : selection;

  for (const override of overrides) assertOverrideMatchesManifest(override);

  return overrides;
}

function readFromStorages({
  storages,
  key,
}: {
  storages: (OverrideStorage | undefined)[];
  key: string;
}): string | null {
  for (const storage of storages) {
    const value = storage?.getItem(key);

    if (value !== null && value !== undefined) return value;
  }

  return null;
}

function parseDevelopmentOffersFromValue(
  value: unknown,
): AtlasRuntimeOverrideDocument & AtlasDevelopmentOffers {
  const document = parseOverrideDocumentFromValue(
    value,
    'the development session',
  );
  const offerIds = isRecord(value) ? value.offerIds : undefined;

  return {
    ...document,
    offerIds: isDevelopmentOfferIds(offerIds) ? offerIds : {},
  };
}

function readOverrideDocumentFromStorage(
  storages: (OverrideStorage | undefined)[],
): AtlasRuntimeOverrideDocument | undefined {
  const stored = readFromStorages({
    storages,
    key: ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY,
  });

  if (!stored) return undefined;

  let value: unknown;

  try {
    value = JSON.parse(stored);
  } catch (error) {
    throw new AtlasOverrideError(
      `Atlas runtime override data in ${ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY} is not valid JSON.`,
      error,
    );
  }

  return parseOverrideDocumentFromValue(
    value,
    ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY,
  );
}

function parseOverrideDocumentFromValue(
  value: unknown,
  source: string,
): AtlasRuntimeOverrideDocument {
  if (!isOverrideDocumentShape(value)) {
    throw new AtlasOverrideError(
      `Atlas runtime override data from ${source} has an invalid document shape.`,
    );
  }

  for (const override of value.overrides) {
    if (!isOverrideEntryShape(override)) {
      throw new AtlasOverrideError(
        `Atlas runtime override data from ${source} contains an invalid app entry.`,
      );
    }
  }

  return value;
}

function isOverrideDocumentShape(
  value: unknown,
): value is AtlasRuntimeOverrideDocument {
  return (
    isRecord(value) &&
    value.schemaVersion === '1' &&
    typeof value.hostId === 'string' &&
    typeof value.generatedAt === 'string' &&
    Array.isArray(value.overrides)
  );
}

function isOverrideEntryShape(value: unknown): value is AtlasRuntimeOverride {
  return (
    isRecord(value) &&
    typeof value.appId === 'string' &&
    isRecord(value.manifest) &&
    typeof value.reason === 'string'
  );
}

function assertOverrideDocumentTargetsHost(
  document: Pick<AtlasRuntimeOverrideDocument, 'hostId'>,
  hostId: string,
): void {
  if (document.hostId !== hostId) {
    throw new AtlasOverrideError(
      `Atlas override targets host "${document.hostId}", but the current host is "${hostId}".`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
