import { assertOverrideMatchesManifest } from '../catalog/catalog-resolution.js';
import { requestDevelopmentSession } from '../development-session/development-session.js';
import { AtlasOverrideError } from '../loader.errors.js';
import type {
  AtlasRuntimeOverride,
  AtlasRuntimeOverrideDocument,
} from '@atlas/schema';
import type {
  AtlasBrowserOverrideOptions,
  OverrideSessionStorage,
} from './overrides.types.js';

export const ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY = 'atlas.runtime-overrides';

export async function loadBrowserRuntimeOverrides(
  options: AtlasBrowserOverrideOptions,
): Promise<AtlasRuntimeOverride[]> {
  const sessionStorage = options.sessionStorage ?? globalThis.sessionStorage;
  const requestSession =
    options.developmentSession ??
    (() => requestDevelopmentSession(options.hostId));
  const developmentDocument = await requestSession();
  const document = developmentDocument
    ? parseOverrideDocumentFromValue(
        developmentDocument,
        'the development session',
      )
    : readOverrideDocumentFromStorage(sessionStorage);

  if (!document) return [];

  assertOverrideDocumentTargetsHost(document, options.hostId);

  for (const override of document.overrides)
    assertOverrideMatchesManifest(override);

  if (developmentDocument) {
    sessionStorage?.setItem?.(
      ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY,
      JSON.stringify(document),
    );
  }

  return document.overrides;
}

function readOverrideDocumentFromStorage(
  sessionStorage: OverrideSessionStorage | undefined,
): AtlasRuntimeOverrideDocument | undefined {
  const stored =
    sessionStorage?.getItem(ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY) ??
    globalThis.localStorage?.getItem(ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY);

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
  document: AtlasRuntimeOverrideDocument,
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
