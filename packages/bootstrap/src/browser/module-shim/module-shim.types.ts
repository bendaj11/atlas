import type { HostModule } from '../host-module.js';

export type ImportShim = (url: string) => Promise<HostModule>;

export interface ModuleShimGlobal {
  esmsInitOptions?: { shimMode: boolean };
  importShim?: ImportShim;
}
