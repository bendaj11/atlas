import type { AtlasHostCatalog, AtlasManifest } from '@atlas/schema';
import { overrideError } from './override-error.js';
import type {
  OverridesContext,
  RuntimeAppOverride,
  RuntimeOverrides,
} from './overrides.types.js';
import { resolveOverrideManifest } from './resolve-override-manifest.js';

export async function applyOverridesDocument({
  runtime,
  dependencies,
  catalog,
  overrides,
}: OverridesContext & {
  catalog: AtlasHostCatalog;
  overrides: RuntimeOverrides;
}): Promise<AtlasHostCatalog> {
  const context = { runtime, dependencies };
  const selectedHost =
    overrides.host?.manifest || overrides.hostOverride || catalog.host;
  const host =
    (await resolveOverrideManifest({ ...context, manifest: selectedHost })) ||
    catalog.host;

  const appsById = new Map(
    catalog.apps.map((manifest) => [manifest.id, manifest]),
  );
  const providersById = new Map(
    (catalog.widgetProviders || []).map((manifest) => [manifest.id, manifest]),
  );
  const externalDependencyIds = new Set(
    catalog.apps.flatMap((manifest) => manifest.externalAppsDependencies || []),
  );

  for (const override of overrides.apps || overrides.overrides || []) {
    const manifest = await resolveOverrideManifest({
      ...context,
      manifest: assertAppOverride(override),
    });
    if (!manifest) continue;

    if (appsById.has(manifest.id)) {
      appsById.set(manifest.id, manifest);
    } else if (externalDependencyIds.has(manifest.id)) {
      providersById.set(manifest.id, manifest);
    } else if (manifest.channel === 'local') {
      appsById.set(manifest.id, manifest);
    } else {
      throw overrideError(
        `Atlas app override "${manifest.id}" (${manifest.channel}) targets neither a catalog app nor an external widget provider of host "${runtime.hostId}".`,
      );
    }
  }

  return {
    ...catalog,
    host,
    apps: [...appsById.values()],
    widgetProviders: [...providersById.values()],
  };
}

function assertAppOverride(override: RuntimeAppOverride): AtlasManifest {
  const { appId, manifest } = override;

  if (!manifest) {
    throw overrideError(`Atlas app override for "${appId}" has no manifest.`);
  }

  if (manifest.kind !== 'app') {
    throw overrideError(
      `Atlas app override for "${appId ?? manifest.id}" carries a ${manifest.kind} manifest instead of an app manifest.`,
    );
  }

  if (manifest.id !== (appId || manifest.id)) {
    throw overrideError(
      `Atlas app override for "${appId}" carries a manifest for app "${manifest.id}".`,
    );
  }

  return manifest;
}
