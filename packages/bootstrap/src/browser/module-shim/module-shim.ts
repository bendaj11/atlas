import type { AtlasError } from '@atlas/schema';
import { bootstrapError } from '../../shared/errors/bootstrap-error.js';
import type { HostModule } from '../host-module.js';

const MODULE_SHIM_URL = '/es-module-shims.js';

export interface ModuleShimGlobal {
  esmsInitOptions?: { shimMode: boolean };
  importShim?: (url: string) => Promise<HostModule>;
}

function moduleShimGlobal(): ModuleShimGlobal {
  return globalThis as typeof globalThis & ModuleShimGlobal;
}

export async function installModuleShim(
  moduleShim: ModuleShimGlobal = moduleShimGlobal(),
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
  moduleShim = moduleShimGlobal(),
}: {
  url: string;
  moduleShim?: ModuleShimGlobal;
}): Promise<HostModule> {
  const importShim = moduleShim.importShim;

  if (!importShim)
    throw moduleLoaderError({
      message: `Atlas ES module loader is not installed; cannot import "${url}".`,
    });

  return importShim(url);
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
