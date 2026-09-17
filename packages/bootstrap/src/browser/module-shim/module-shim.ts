import { ModuleLoaderUnavailableError } from '../../shared/errors/index.js';
import type { HostModule } from '../host-module.js';
import type { ModuleShimGlobal } from './module-shim.types.js';

const MODULE_SHIM_URL = '/es-module-shims.js';

export async function installModuleShim(
  moduleShim: ModuleShimGlobal = getModuleShimFromGlobalThis(),
): Promise<void> {
  moduleShim.esmsInitOptions = { shimMode: true };

  if (typeof moduleShim.importShim !== 'function') {
    try {
      await import(MODULE_SHIM_URL);
    } catch (cause) {
      throw new ModuleLoaderUnavailableError(
        `Atlas could not load the ES module shim from "${MODULE_SHIM_URL}".`,
        { cause },
      );
    }
  }

  if (typeof moduleShim.importShim !== 'function') {
    throw new ModuleLoaderUnavailableError(
      `Atlas ES module shim at "${MODULE_SHIM_URL}" did not install importShim.`,
    );
  }
}

export function importModule({
  url,
  moduleShim = getModuleShimFromGlobalThis(),
}: {
  url: string;
  moduleShim?: ModuleShimGlobal;
}): Promise<HostModule> {
  const importShim = moduleShim.importShim;

  if (!importShim) {
    throw new ModuleLoaderUnavailableError(
      `Atlas ES module loader is not installed; cannot import "${url}".`,
    );
  }

  return importShim(url);
}

function getModuleShimFromGlobalThis(): ModuleShimGlobal {
  return globalThis as typeof globalThis & ModuleShimGlobal;
}
