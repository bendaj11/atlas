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
    runtime: (runtime: AtlasHostRuntimeConfig) => {
      this.runtime = runtime;

      return this;
    },
  };

  readonly when = {
    environmentRegistryUrlBuilt: () => {
      this.url = environmentRegistryUrl(this.runtime);
    },
    environmentManifestUrlBuilt: () => {
      this.url = environmentManifestUrl(this.runtime);
    },
    artifactUrlBuilt: (path: string) => {
      this.url = artifactUrl(this.runtime, path);
    },
  };

  readonly get = {
    url: () => this.url,
  };
}
