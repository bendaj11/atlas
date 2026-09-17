import type { AtlasHostRuntimeConfig } from '../atlas-host-runtime-config.js';
import { resolveAtlasRuntimeConfig } from './resolve-host-runtime-config.js';

export class ResolveHostRuntimeConfigDriver {
  private hostUrl: string | undefined;
  private runtime: AtlasHostRuntimeConfig | undefined;
  private error: unknown;

  readonly given = {
    hostUrl: (hostUrl: string | undefined): ResolveHostRuntimeConfigDriver => {
      this.hostUrl = hostUrl;

      return this;
    },
  };

  readonly when = {
    resolved: (value: unknown): void => {
      try {
        this.runtime = resolveAtlasRuntimeConfig(value, this.hostUrl);
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    runtime: (): AtlasHostRuntimeConfig | undefined => this.runtime,
    error: (): unknown => this.error,
  };
}
