import type { AtlasError } from '@atlas/schema';
import { bootstrapError, type BootstrapErrorOptions } from '../index.js';

export class BootstrapErrorDriver {
  private error!: AtlasError;

  readonly when = {
    created: (options: BootstrapErrorOptions): void => {
      this.error = bootstrapError(options);
    },
  };

  readonly get = {
    error: (): AtlasError => this.error,
  };
}
