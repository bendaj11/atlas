import type { AtlasHostRuntimeConfig } from '@atlas/schema';
import {
  artifactUrl,
  assertAtlasRuntimeConfig,
  environmentManifestUrl,
  environmentRegistryUrl,
  resolveAtlasRuntimeConfig,
} from './runtime-config.js';

export class RuntimeConfigDriver {
  private value: unknown;
  private hostUrl: string | undefined;
  private runtime!: AtlasHostRuntimeConfig;
  private resolvedRuntime: AtlasHostRuntimeConfig | undefined;
  private url: string | undefined;
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
    runtime: (runtime: AtlasHostRuntimeConfig): RuntimeConfigDriver => {
      this.runtime = runtime;

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
    environmentRegistryUrlBuilt: (): void => {
      this.url = environmentRegistryUrl(this.runtime);
    },
    environmentManifestUrlBuilt: (): void => {
      this.url = environmentManifestUrl(this.runtime);
    },
    artifactUrlBuilt: (path: string): void => {
      this.url = artifactUrl(this.runtime, path);
    },
  };

  readonly get = {
    runtime: (): AtlasHostRuntimeConfig | undefined => this.resolvedRuntime,
    url: (): string | undefined => this.url,
    error: (): unknown => this.error,
  };
}
