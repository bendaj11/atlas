import type { HostModule } from '../types.js';
import { faker } from '@faker-js/faker';
import { importModule } from './module-shim.js';

export class ModuleShimDriver {
  private error: unknown;
  private module: HostModule | undefined;
  private moduleUrl = faker.internet.url();

  readonly given = {
    unavailable: (moduleUrl: string): ModuleShimDriver => {
      this.moduleUrl = moduleUrl;
      delete (globalThis as typeof globalThis & { importShim?: unknown })
        .importShim;
      return this;
    },
    available: (module: HostModule): ModuleShimDriver => {
      (
        globalThis as typeof globalThis & {
          importShim?: (url: string) => Promise<HostModule>;
        }
      ).importShim = async () => module;
      return this;
    },
  };

  readonly when = {
    import: async (): Promise<void> => {
      try {
        this.module = await importModule(this.moduleUrl);
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    error: (): unknown => this.error,
    module: (): HostModule | undefined => this.module,
  };
}
