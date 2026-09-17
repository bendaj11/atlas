import type { AtlasHostCatalog } from '@atlas/schema';
import type { DevSession } from './overrides.types.js';

export function mergeDevelopmentSession({
  catalog,
  session,
}: {
  catalog: AtlasHostCatalog;
  session: DevSession;
}): AtlasHostCatalog {
  const sessionOverrides = session.overrides || [];
  const manifestsByAppId = new Map(
    sessionOverrides.map((override) => [override.appId, override.manifest]),
  );

  const apps = catalog.apps.map(
    (manifest) => manifestsByAppId.get(manifest.id) || manifest,
  );
  const presentAppIds = new Set(apps.map((manifest) => manifest.id));

  for (const override of sessionOverrides) {
    if (!override.appId || !override.manifest) continue;
    if (presentAppIds.has(override.appId)) continue;

    apps.push(override.manifest);
  }

  return {
    ...catalog,
    ...(session.generatedAt ? { generatedAt: session.generatedAt } : {}),
    host: session.hostOverride || catalog.host,
    apps,
  };
}
