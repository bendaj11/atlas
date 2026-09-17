import { jest } from '@jest/globals';
import type { HostModule } from '../host-module.js';
import {
  importModule,
  installModuleShim,
  type ImportShim,
  type ModuleShimGlobal,
} from './index.js';

export class ModuleShimDriver {
  private readonly moduleShim: ModuleShimGlobal = {};
  private readonly importShim = jest.fn<ImportShim>();
  private module: HostModule | undefined;
  private error: unknown;

  readonly given = {
    importShimInstalled: (module: HostModule) => {
      this.importShim.mockResolvedValue(module);
      this.moduleShim.importShim = this.importShim;

      return this;
    },
  };

  readonly when = {
    installed: async () => {
      try {
        await installModuleShim(this.moduleShim);
      } catch (error) {
        this.error = error;
      }
    },
    imported: async (url: string) => {
      try {
        this.module = await importModule({ url, moduleShim: this.moduleShim });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    module: () => this.module,
    error: () => this.error,
    shimOptions: () => this.moduleShim.esmsInitOptions,
    importShimMock: () => this.importShim,
  };
}
