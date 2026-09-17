import type { AtlasHostRuntimeConfig } from '@atlas/schema';
import {
  assertAtlasRuntimeConfig,
  resolveAtlasRuntimeConfig,
} from './runtime-config.js';

export class RuntimeConfigDriver {
  private value: unknown;
  private hostUrl: string | undefined;
  private resolvedRuntime: AtlasHostRuntimeConfig | undefined;
  private error: unknown;

  readonly given = {
    value: (value: unknown): RuntimeConfigDriver => {
      this.value = value;

      return this;
    },
    hostUrl: (hostUrl: string | undefined): RuntimeConfigDriver => {
      this.hostUrl = hostUrl;

      return this;
    },
  };

  readonly when = {
    resolved: (): void => {
      try {
        this.resolvedRuntime = resolveAtlasRuntimeConfig(
          this.value,
          this.hostUrl,
        );
      } catch (error) {
        this.error = error;
      }
    },
    asserted: (): void => {
      try {
        assertAtlasRuntimeConfig(this.value);
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    runtime: (): AtlasHostRuntimeConfig | undefined => this.resolvedRuntime,
    error: (): unknown => this.error,
  };
}
