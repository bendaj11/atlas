import type { AtlasHostCatalog } from '@atlas/schema';
import { loadHostDeployment } from '@atlas/runtime';
import { errorMessage, ui } from '../../shared/index.js';
import type { PublishedCatalogLoader } from '../types.js';

const warnedCatalogs = new Set<string>();

export const readPublishedCatalog: PublishedCatalogLoader = ({
  registryUrl,
  hostId,
  environment,
}): Promise<AtlasHostCatalog> => {
  const root = registryUrl.endsWith('/') ? registryUrl : `${registryUrl}/`;
  const manifestPath = `environments/${encodeURIComponent(environment)}/hosts/${encodeURIComponent(hostId)}/manifest.json`;

  return loadHostDeployment({
    manifestUrl: new URL(manifestPath, root).href,
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
    `Published catalog for host "${hostId}" could not be loaded from ${registryUrl}; serving local overrides only. ${errorMessage(error)}`,
  );
}
