import type { AtlasHostManifest, AtlasHostRuntimeConfig } from '@atlas/schema';
import { validateHostManifest } from './validate-host-manifest.js';

export class ValidateHostManifestDriver {
  private runtime!: AtlasHostRuntimeConfig;
  private manifest!: AtlasHostManifest;
  private error: unknown;

  readonly given = {
    runtime: (runtime: AtlasHostRuntimeConfig) => {
      this.runtime = runtime;

      return this;
    },
    manifest: (manifest: AtlasHostManifest) => {
      this.manifest = manifest;

      return this;
    },
  };

  readonly when = {
    hostManifestValidated: () => {
      try {
        validateHostManifest({
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
