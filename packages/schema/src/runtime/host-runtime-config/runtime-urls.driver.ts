import type { AtlasHostRuntimeConfig } from '../atlas-host-runtime-config.js';
import {
  buildArtifactUrl,
  buildEnvironmentManifestUrl,
  resolveEnvironmentRegistryUrl,
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
      this.url = resolveEnvironmentRegistryUrl(this.runtime);
    },
    environmentManifestUrlBuilt: () => {
      this.url = buildEnvironmentManifestUrl(this.runtime);
    },
    artifactUrlBuilt: (path: string) => {
      this.url = buildArtifactUrl(this.runtime, path);
    },
  };

  readonly get = {
    url: () => this.url,
  };
}
