import type { AtlasHostManifest, AtlasHostRuntimeConfig } from '@atlas/schema';
import { validateHostManifest } from './validate-host-manifest.js';

export class ValidateHostManifestDriver {
  private runtime!: AtlasHostRuntimeConfig;
  private manifest!: AtlasHostManifest;
  private error: unknown;

  readonly given = {
    runtime: (runtime: AtlasHostRuntimeConfig): ValidateHostManifestDriver => {
      this.runtime = runtime;

      return this;
    },
    manifest: (manifest: AtlasHostManifest): ValidateHostManifestDriver => {
      this.manifest = manifest;

      return this;
    },
  };

  readonly when = {
    hostManifestValidated: (): void => {
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
    error: (): unknown => this.error,
  };
}
