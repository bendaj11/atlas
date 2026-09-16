import type { AtlasHostRuntimeConfig } from '@atlas/schema';
import { resolveAtlasRuntimeConfig } from './runtime-config.js';

export class RuntimeConfigDriver {
  private hostUrl: string | undefined = 'https://host.example/orders/42';
  private runtime: AtlasHostRuntimeConfig = {
    schemaVersion: 'v1',
    hostId: 'host',
    environment: 'production',
    artifactRegistryUrl: '/atlas',
  };
  private resolvedRuntime: AtlasHostRuntimeConfig | undefined;
  private error: unknown;

  readonly given = {
    artifactRegistryUrl: (artifactRegistryUrl: string): RuntimeConfigDriver => {
      this.runtime = { ...this.runtime, artifactRegistryUrl };
      return this;
    },
    environmentRegistryUrl: (
      environmentRegistryUrl: string,
    ): RuntimeConfigDriver => {
      this.runtime = { ...this.runtime, environmentRegistryUrl };
      return this;
    },
    hostUrl: (hostUrl: string | undefined): RuntimeConfigDriver => {
      this.hostUrl = hostUrl;
      return this;
    },
  };

  readonly when = {
    resolve: (): void => {
      try {
        this.resolvedRuntime = resolveAtlasRuntimeConfig(
          this.runtime,
          this.hostUrl,
        );
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    error: (): unknown => this.error,
    runtime: (): AtlasHostRuntimeConfig | undefined => this.resolvedRuntime,
  };
}
