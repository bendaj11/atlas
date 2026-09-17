import type { AtlasHostCatalog } from '@atlas/schema';
import { requestDevelopmentSession } from '../development-session/index.js';
import { fetchJson } from '../fetch-json/index.js';
import { loadPublishedArtifact } from '../published-artifact/index.js';
import { applyOverridesDocument } from './apply-overrides-document.js';
import {
  discoverDevelopmentSession,
  storeDevelopmentSession,
  storedOverridesDocument,
} from './development-session-source.js';
import { mergeDevelopmentSession } from './merge-development-session.js';
import type {
  ApplyOverridesOptions,
  OverridesDependencies,
  RuntimeOverrides,
} from './overrides.types.js';

export async function applyOverrides({
  runtime,
  catalog,
  developmentSession,
  dependencies = defaultDependencies(),
}: ApplyOverridesOptions): Promise<AtlasHostCatalog> {
  const context = { runtime, dependencies };
  const session =
    developmentSession ?? (await discoverDevelopmentSession(context));

  const stored = session
    ? storeDevelopmentSession({ session, dependencies })
    : storedOverridesDocument(dependencies);
  const baseCatalog = session
    ? mergeDevelopmentSession({ catalog, session })
    : catalog;

  if (!stored) return baseCatalog;

  const overrides = JSON.parse(stored) as RuntimeOverrides;
  if (overrides.hostId !== runtime.hostId) return baseCatalog;

  return applyOverridesDocument({
    ...context,
    catalog: baseCatalog,
    overrides,
  });
}

function defaultDependencies(): OverridesDependencies {
  return {
    sessionStorage,
    localStorage,
    fetchJson,
    requestDevelopmentSession,
    loadPublishedArtifact,
  };
}
