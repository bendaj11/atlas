import type { AtlasHostRuntimeConfig } from '../atlas-host-runtime-config.js';
import { resolveAtlasHostRuntimeConfig } from './resolve-host-runtime-config.js';

export class ResolveHostRuntimeConfigDriver {
  private hostUrl: string | undefined;
  private runtime: AtlasHostRuntimeConfig | undefined;
  private error: unknown;

  readonly given = {
    hostUrl: (hostUrl: string | undefined) => {
      this.hostUrl = hostUrl;

      return this;
    },
  };

  readonly when = {
    resolved: (value: unknown) => {
      try {
        this.runtime = resolveAtlasHostRuntimeConfig(value, this.hostUrl);
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    runtime: () => this.runtime,
    error: () => this.error,
  };
}
