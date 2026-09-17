import type { AtlasHostCatalog } from '@atlas/schema';
import { CatalogInvalidError } from '../../../shared/errors/index.js';
import type { DevSession } from '../../overrides/index.js';
import type {
  AtlasLoaderDependencies,
  LoaderContext,
} from '../atlas-loader.types.js';
import { loadDeploymentCatalog } from '../deployment-catalog/deployment-catalog.js';

export type StartupCatalogDependencies = Pick<
  AtlasLoaderDependencies,
  'fetchJson' | 'fetchBytes' | 'loadPublishedArtifact'
>;

export interface StartupCatalogContext extends Pick<LoaderContext, 'runtime'> {
  dependencies: StartupCatalogDependencies;
}

export interface StartupCatalog {
  catalog: AtlasHostCatalog;
  developmentSession?: DevSession;
}

export async function loadStartupCatalog({
  runtime,
  dependencies,
}: StartupCatalogContext): Promise<StartupCatalog> {
  if (!runtime.developmentSessionUrl) {
    return { catalog: await loadDeploymentCatalog({ runtime, dependencies }) };
  }

  const developmentSession = await dependencies.fetchJson<DevSession>({
    url: runtime.developmentSessionUrl,
    runtime,
  });

  if (!developmentSession.catalog) {
    throw new CatalogInvalidError(
      `Atlas development session at "${runtime.developmentSessionUrl}" does not include a host catalog.`,
    );
  }

  return { catalog: developmentSession.catalog, developmentSession };
}
