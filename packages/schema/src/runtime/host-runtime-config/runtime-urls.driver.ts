import type { AtlasHostRuntimeConfig } from '../atlas-host-runtime-config.js';
import {
  artifactUrl,
  environmentManifestUrl,
  environmentRegistryUrl,
} from './runtime-urls.js';

export class RuntimeUrlsDriver {
  private runtime!: AtlasHostRuntimeConfig;
  private url!: string;

  readonly given = {
    runtime: (runtime: AtlasHostRuntimeConfig): RuntimeUrlsDriver => {
      this.runtime = runtime;

      return this;
    },
  };

  readonly when = {
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
    url: (): string => this.url,
  };
}
