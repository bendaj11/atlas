import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import { validateCatalog } from './validate-catalog.js';

export class ValidateCatalogDriver {
  private runtime!: AtlasHostRuntimeConfig;
  private catalog!: AtlasHostCatalog;
  private error: unknown;

  readonly given = {
    runtime: (runtime: AtlasHostRuntimeConfig) => {
      this.runtime = runtime;

      return this;
    },
    catalog: (catalog: AtlasHostCatalog) => {
      this.catalog = catalog;

      return this;
    },
  };

  readonly when = {
    catalogValidated: () => {
      try {
        validateCatalog({ runtime: this.runtime, catalog: this.catalog });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    error: () => this.error,
  };
}
