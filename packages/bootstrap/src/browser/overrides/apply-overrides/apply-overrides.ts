import {
  mergeDevelopmentOffers,
  parseDismissedDevelopmentOffers,
  type AtlasHostCatalog,
} from '@atlas/schema';
import { requestDevelopmentSession } from '../../development-session/index.js';
import { fetchJson } from '../../fetch-json/index.js';
import { loadPublishedArtifact } from '../../published-artifact/index.js';
import { applyOverridesDocument } from '../apply-overrides-document/apply-overrides-document.js';
import {
  discoverDevelopmentSession,
  readDismissedDevelopmentOffers,
  readStoredOverridesDocument,
} from '../development-session-source/development-session-source.js';
import type {
  ApplyOverridesOptions,
  OverridesDependencies,
  RuntimeOverrides,
} from '../overrides.types.js';

export async function applyOverrides({
  runtime,
  catalog,
  developmentSession,
  dependencies = createBrowserOverridesDependencies(),
}: ApplyOverridesOptions): Promise<AtlasHostCatalog> {
  const context = { runtime, dependencies };
  const session =
    developmentSession ?? (await discoverDevelopmentSession(context));
  const storedText = readStoredOverridesDocument(dependencies);
  const parsed = storedText
    ? (JSON.parse(storedText) as RuntimeOverrides)
    : undefined;
  const stored = parsed?.hostId === runtime.hostId ? parsed : undefined;
  const hostOverride = stored?.host?.manifest || stored?.hostOverride;
  const selection = {
    overrides: stored?.apps || stored?.overrides || [],
    ...(hostOverride ? { hostOverride } : {}),
  };
  const overrides = session
    ? mergeDevelopmentOffers({
        selection,
        offers: {
          overrides: session.overrides || [],
          ...(session.hostOverride
            ? { hostOverride: session.hostOverride }
            : {}),
          offerIds: session.offerIds || {},
        },
        dismissedOfferIds: parseDismissedDevelopmentOffers(
          readDismissedDevelopmentOffers({
            hostId: runtime.hostId,
            dependencies,
          }),
        ),
      })
    : selection;

  if (overrides.overrides.length === 0 && !overrides.hostOverride)
    return catalog;

  return applyOverridesDocument({ ...context, catalog, overrides });
}

function createBrowserOverridesDependencies(): OverridesDependencies {
  return {
    sessionStorage,
    localStorage,
    fetchJson,
    requestDevelopmentSession,
    loadPublishedArtifact,
  };
}
