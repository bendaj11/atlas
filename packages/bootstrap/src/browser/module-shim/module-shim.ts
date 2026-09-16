import { MODULE_SHIM_URL } from '../constants.js';
import type { HostModule, ModuleShimGlobal } from '../types.js';

const moduleShim = globalThis as typeof globalThis & ModuleShimGlobal;

export async function installModuleShim(): Promise<void> {
  moduleShim.esmsInitOptions = { shimMode: true };

  if (typeof moduleShim.importShim !== 'function') await import(MODULE_SHIM_URL);

  if (typeof moduleShim.importShim !== 'function') {
    throw new Error('Atlas could not initialize the ES module loader.');
  }
}

export function importModule(url: string): Promise<HostModule> {
  const importShim = moduleShim.importShim;

  if (!importShim)
    throw new Error('Atlas could not initialize the ES module loader.');

  return importShim(url);
}
