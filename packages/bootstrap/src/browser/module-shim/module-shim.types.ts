import type { HostModule } from '../host-module.js';

export interface ModuleShimGlobal {
  esmsInitOptions?: { shimMode: boolean };
  importShim?: (url: string) => Promise<HostModule>;
}
