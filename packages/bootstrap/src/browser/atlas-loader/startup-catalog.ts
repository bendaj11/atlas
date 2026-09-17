import type { AtlasHostCatalog } from '@atlas/schema';
import { bootstrapError } from '../../shared/errors/index.js';
import type { DevSession } from '../overrides/index.js';
import type { LoaderContext } from './atlas-loader.types.js';
import { loadDeploymentCatalog } from './deployment-catalog.js';

export interface StartupCatalog {
  catalog: AtlasHostCatalog;
  developmentSession?: DevSession;
}

export async function loadStartupCatalog({
  runtime,
  dependencies,
}: LoaderContext): Promise<StartupCatalog> {
  if (!runtime.developmentSessionUrl) {
    return { catalog: await loadDeploymentCatalog({ runtime, dependencies }) };
  }

  const developmentSession = await dependencies.fetchJson<DevSession>({
    url: runtime.developmentSessionUrl,
    runtime,
  });

  if (!developmentSession.catalog) {
    throw bootstrapError({
      code: 'CATALOG_INVALID',
      message: `Atlas development session at "${runtime.developmentSessionUrl}" does not include a host catalog.`,
    });
  }

  return { catalog: developmentSession.catalog, developmentSession };
}
