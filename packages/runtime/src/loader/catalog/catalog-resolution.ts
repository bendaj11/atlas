import {
  assertAtlasManifest,
  type AtlasHostCatalog,
  type AtlasManifest,
} from '@atlas/schema';
import { extractErrorMessage } from '../../shared/errors.js';
import {
  AtlasCatalogSelectionError,
  AtlasOverrideError,
} from '../loader.errors.js';
import type { AtlasRuntimeOverride } from '../overrides/overrides.types.js';
import { assertLocalManifestUsesLoopbackUrls } from '../trust/trust-policy.js';

export function resolveRuntimeManifests(
  catalog: AtlasHostCatalog,
  overrides: AtlasRuntimeOverride[] = [],
): AtlasManifest[] {
  return resolveRuntimeCatalog(catalog, overrides).apps;
}

export function resolveRuntimeCatalog(
  catalog: AtlasHostCatalog,
  overrides: AtlasRuntimeOverride[] = [],
): AtlasHostCatalog {
  const appsById = indexManifestsById(catalog.apps, new Map());
  const providersById = indexManifestsById(
    catalog.widgetProviders ?? [],
    appsById,
  );
  const overriddenAppIds = new Set<string>();

  for (const override of overrides) {
    assertOverrideMatchesManifest(override);

    if (overriddenAppIds.has(override.appId)) {
      throw new AtlasOverrideError(
        `Atlas overrides contain more than one entry for app "${override.appId}".`,
      );
    }

    const selected =
      appsById.get(override.appId) ?? providersById.get(override.appId);

    if (!selected && override.manifest.channel !== 'local') {
      throw new AtlasOverrideError(
        `Atlas override targets app "${override.appId}", but the host catalog does not select that app or widget provider.`,
      );
    }

    assertManifestSupportsHost({
      manifest: override.manifest,
      hostId: catalog.hostId,
      source: 'override',
    });

    assertLocalManifestUsesLoopbackUrls(override.manifest);
    overriddenAppIds.add(override.appId);

    const resolved = selected
      ? {
          ...override.manifest,
          supportedHosts: selected.supportedHosts,
          placements: selected.placements,
        }
      : override.manifest;

    if (providersById.has(override.appId))
      providersById.set(override.appId, resolved);
    else appsById.set(override.appId, resolved);
  }

  for (const manifest of [...appsById.values(), ...providersById.values()]) {
    assertManifestSupportsHost({
      manifest,
      hostId: catalog.hostId,
      source: 'catalog',
    });

    assertLocalManifestUsesLoopbackUrls(manifest);
  }

  return {
    ...catalog,
    apps: [...appsById.values()],
    ...(catalog.widgetProviders || providersById.size > 0
      ? { widgetProviders: [...providersById.values()] }
      : {}),
  };
}

export function assertOverrideMatchesManifest(
  override: AtlasRuntimeOverride,
): void {
  try {
    assertAtlasManifest(override.manifest);
  } catch (error) {
    throw new AtlasOverrideError(
      `Atlas override for app "${override.appId}" is invalid: ${extractErrorMessage(error)}`,
      error,
    );
  }

  if (override.appId !== override.manifest.id) {
    throw new AtlasOverrideError(
      `Atlas override app id "${override.appId}" does not match its manifest id "${override.manifest.id}".`,
    );
  }
}

function indexManifestsById(
  manifests: readonly AtlasManifest[],
  takenIds: ReadonlyMap<string, AtlasManifest>,
): Map<string, AtlasManifest> {
  const byId = new Map<string, AtlasManifest>();

  for (const manifest of manifests) {
    if (takenIds.has(manifest.id) || byId.has(manifest.id)) {
      throw new AtlasCatalogSelectionError(
        `Atlas catalog selects multiple versions of app "${manifest.id}".`,
      );
    }

    byId.set(manifest.id, manifest);
  }

  return byId;
}

function assertManifestSupportsHost(input: {
  manifest: AtlasManifest;
  hostId: string;
  source: 'catalog' | 'override';
}): void {
  const { manifest, hostId, source } = input;

  if (
    !manifest.supportedHosts.includes('*') &&
    !manifest.supportedHosts.includes(hostId)
  ) {
    throw new AtlasCatalogSelectionError(
      `Atlas ${source} manifest for app "${manifest.id}" does not support host "${hostId}".`,
    );
  }
}
