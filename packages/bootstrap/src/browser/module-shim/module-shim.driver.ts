import { jest } from '@jest/globals';
import type { HostModule } from '../host-module.js';
import {
  importModule,
  installModuleShim,
  type ModuleShimGlobal,
} from './index.js';

export class ModuleShimDriver {
  private readonly moduleShim: ModuleShimGlobal = {};
  private readonly importShim =
    jest.fn<NonNullable<ModuleShimGlobal['importShim']>>();
  private module: HostModule | undefined;
  private error: unknown;

  readonly given = {
    importShimInstalled: (module: HostModule): ModuleShimDriver => {
      this.importShim.mockResolvedValue(module);
      this.moduleShim.importShim = this.importShim;

      return this;
    },
  };

  readonly when = {
    installed: async (): Promise<void> => {
      try {
        await installModuleShim(this.moduleShim);
      } catch (error) {
        this.error = error;
      }
    },
    imported: async (url: string): Promise<void> => {
      try {
        this.module = await importModule({ url, moduleShim: this.moduleShim });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    module: (): HostModule | undefined => this.module,
    error: (): unknown => this.error,
    shimOptions: (): ModuleShimGlobal['esmsInitOptions'] =>
      this.moduleShim.esmsInitOptions,
    importShimMock: () => this.importShim,
  };
}
