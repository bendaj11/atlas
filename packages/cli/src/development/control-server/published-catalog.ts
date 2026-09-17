import type { AtlasHostCatalog } from '@atlas/schema';
import { loadHostDeployment } from '@atlas/runtime';
import { buildHostManifestPath } from '../../deployment/index.js';
import {
  extractErrorMessage,
  trimTrailingSlash,
  ui,
} from '../../shared/index.js';
import type { PublishedCatalogLoader } from '../types.js';

const warnedCatalogs = new Set<string>();

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
