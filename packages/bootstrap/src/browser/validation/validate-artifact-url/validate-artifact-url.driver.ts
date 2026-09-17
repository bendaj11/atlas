import type {
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
} from '@atlas/schema';
import { validateArtifactUrl } from './validate-artifact-url.js';

export class ValidateArtifactUrlDriver {
  private runtime!: AtlasHostRuntimeConfig;
  private manifest!: AtlasHostManifest | AtlasManifest;
  private url!: URL;
  private error: unknown;

  readonly given = {
    runtime: (runtime: AtlasHostRuntimeConfig) => {
      this.runtime = runtime;

      return this;
    },
    manifest: (manifest: AtlasHostManifest | AtlasManifest) => {
      this.manifest = manifest;

      return this;
    },
    url: (url: URL) => {
      this.url = url;

      return this;
    },
  };

  readonly when = {
    artifactUrlValidated: () => {
      try {
        validateArtifactUrl({
          url: this.url,
          manifest: this.manifest,
          runtime: this.runtime,
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    error: () => this.error,
  };
}
