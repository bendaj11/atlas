import type { AtlasError } from '@atlas/schema';
import { bootstrapError } from '../../shared/errors/index.js';
import type { HostModule } from '../host-module.js';
import type { ModuleShimGlobal } from './module-shim.types.js';

const MODULE_SHIM_URL = '/es-module-shims.js';

export async function installModuleShim(
  moduleShim: ModuleShimGlobal = moduleShimFromGlobalThis(),
): Promise<void> {
  moduleShim.esmsInitOptions = { shimMode: true };

  if (typeof moduleShim.importShim !== 'function') {
    try {
      await import(MODULE_SHIM_URL);
    } catch (cause) {
      throw moduleLoaderError({
        message: `Atlas could not load the ES module shim from "${MODULE_SHIM_URL}".`,
        cause,
      });
    }
  }

  if (typeof moduleShim.importShim !== 'function') {
    throw moduleLoaderError({
      message: `Atlas ES module shim at "${MODULE_SHIM_URL}" did not install importShim.`,
    });
  }
}

export function importModule({
  url,
  moduleShim = moduleShimFromGlobalThis(),
}: {
  url: string;
  moduleShim?: ModuleShimGlobal;
}): Promise<HostModule> {
  const importShim = moduleShim.importShim;

  if (!importShim) {
    throw moduleLoaderError({
      message: `Atlas ES module loader is not installed; cannot import "${url}".`,
    });
  }

  return importShim(url);
}

function moduleShimFromGlobalThis(): ModuleShimGlobal {
  return globalThis as typeof globalThis & ModuleShimGlobal;
}

function moduleLoaderError({
  message,
  cause,
}: {
  message: string;
  cause?: unknown;
}): AtlasError {
  return bootstrapError({
    code: 'MODULE_LOADER_UNAVAILABLE',
    message,
    ...(cause === undefined ? {} : { cause }),
  });
}
