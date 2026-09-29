import type { AtlasHostCatalog } from '@atlas/schema';
import { loadHostDeployment } from '@atlas/runtime';
import { buildHostManifestPath } from '../../deployment/index.js';
import {
  extractErrorMessage,
  trimTrailingSlash,
  ui,
} from '../../shared/index.js';
import type { PublishedCatalogLoader } from '../types.js';

const CATALOG_FRESH_MS = 30_000;
const warnedCatalogs = new Set<string>();

interface CachedCatalog {
  catalog: AtlasHostCatalog | undefined;
  loadedAt: number;
  refresh: Promise<AtlasHostCatalog> | undefined;
}

export function withCatalogCache(
  load: PublishedCatalogLoader,
): PublishedCatalogLoader {
  const entries = new Map<string, CachedCatalog>();

  return async (options) => {
    const { registryUrl, hostId, environment } = options;
    const key = JSON.stringify([registryUrl, hostId, environment]);
    const entry = entries.get(key) ?? {
      catalog: undefined,
      loadedAt: 0,
      refresh: undefined,
    };
    entries.set(key, entry);

    if (entry.catalog && Date.now() - entry.loadedAt < CATALOG_FRESH_MS)
      return entry.catalog;

    entry.refresh ??= load(options)
      .then((catalog) => {
        entry.catalog = catalog;
        entry.loadedAt = Date.now();

        return catalog;
      })
      .finally(() => {
        entry.refresh = undefined;
      });

    if (entry.catalog) {
      entry.refresh.catch(() => undefined);

      return entry.catalog;
    }

    return entry.refresh;
  };
}

export const readPublishedCatalog: PublishedCatalogLoader = ({
  registryUrl,
  hostId,
  environment,
}): Promise<AtlasHostCatalog> => {
  const manifestPath = buildHostManifestPath({ environment, hostId });

  return loadHostDeployment({
    manifestUrl: new URL(manifestPath, `${trimTrailingSlash(registryUrl)}/`)
      .href,
    expectedHostId: hostId,
    expectedEnvironment: environment,
  });
};

export function warnPublishedCatalogOnce({
  registryUrl,
  hostId,
  error,
}: {
  registryUrl: string;
  hostId: string;
  error: unknown;
}): void {
  const key = `${registryUrl}|${hostId}`;

  if (warnedCatalogs.has(key)) return;

  warnedCatalogs.add(key);
  ui.warning(
    `Published catalog for host "${hostId}" could not be loaded from ${registryUrl}; serving local overrides only. ${extractErrorMessage(error)}`,
  );
}
