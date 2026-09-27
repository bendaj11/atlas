import type {
  AtlasHostCatalog,
  AtlasManifest,
  AtlasStaticRegistry,
} from '@atlas/schema';
import { OverrideInvalidError } from '../../../shared/errors/index.js';
import type {
  RuntimeAppOverride,
  RuntimeOverrides,
} from '../overrides.types.js';
import {
  resolveOverrideManifest,
  type FetchStaticRegistry,
  type ResolveOverrideManifestContext,
} from '../resolve-override-manifest/resolve-override-manifest.js';

export async function applyOverridesDocument({
  runtime,
  dependencies,
  catalog,
  overrides,
}: ResolveOverrideManifestContext & {
  catalog: AtlasHostCatalog;
  overrides: RuntimeOverrides;
}): Promise<AtlasHostCatalog> {
  const context = {
    runtime,
    dependencies: {
      loadPublishedArtifact: dependencies.loadPublishedArtifact,
      fetchJson: shareRegistryRequests(dependencies.fetchJson),
    },
  };
  const selectedHost =
    overrides.host?.manifest || overrides.hostOverride || catalog.host;
  const hostResolving = resolveOverrideManifest({
    ...context,
    manifest: selectedHost,
  });
  const appsResolving = Promise.allSettled(
    (overrides.apps || overrides.overrides || []).map(async (override) =>
      resolveOverrideManifest({
        ...context,
        manifest: extractAppManifestFromOverride(override),
      }),
    ),
  );
  const resolvedHost = await hostResolving;
  const appResolutions = await appsResolving;
  const host = resolvedHost || catalog.host;

  const appsById = new Map(
    catalog.apps.map((manifest) => [manifest.id, manifest]),
  );
  const providersById = new Map(
    (catalog.widgetProviders || []).map((manifest) => [manifest.id, manifest]),
  );
  const externalDependencyIds = new Set(
    catalog.apps.flatMap((manifest) => manifest.externalAppsDependencies || []),
  );

  for (const resolution of appResolutions) {
    if (resolution.status === 'rejected') throw resolution.reason;

    const manifest = resolution.value;

    if (!manifest) continue;

    if (appsById.has(manifest.id)) {
      appsById.set(manifest.id, manifest);
    } else if (externalDependencyIds.has(manifest.id)) {
      providersById.set(manifest.id, manifest);
    } else if (manifest.channel === 'local') {
      appsById.set(manifest.id, manifest);
    } else {
      throw new OverrideInvalidError(
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

function extractAppManifestFromOverride(
  override: RuntimeAppOverride,
): AtlasManifest {
  const { appId, manifest } = override;

  if (!manifest) {
    throw new OverrideInvalidError(
      `Atlas app override for "${appId}" has no manifest.`,
    );
  }

  if (manifest.kind !== 'app') {
    throw new OverrideInvalidError(
      `Atlas app override for "${appId ?? manifest.id}" carries a ${manifest.kind} manifest instead of an app manifest.`,
    );
  }

  if (manifest.id !== (appId || manifest.id)) {
    throw new OverrideInvalidError(
      `Atlas app override for "${appId}" carries a manifest for app "${manifest.id}".`,
    );
  }

  return manifest;
}

function shareRegistryRequests(
  fetchJson: FetchStaticRegistry,
): FetchStaticRegistry {
  const requests = new Map<string, Promise<AtlasStaticRegistry>>();

  return (options) => {
    const pending = requests.get(options.url) ?? fetchJson(options);
    requests.set(options.url, pending);

    return pending;
  };
}
