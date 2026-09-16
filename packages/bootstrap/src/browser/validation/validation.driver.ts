import type {
  AtlasHostCatalog,
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
} from '@atlas/schema';
import {
  validateArtifactUrl,
  validateCatalog,
  validateHostManifest,
} from './validation.js';

export class ValidationDriver {
  private runtime!: AtlasHostRuntimeConfig;
  private catalog!: AtlasHostCatalog;
  private manifest!: AtlasHostManifest | AtlasManifest;
  private url!: URL;
  private error: unknown;

  readonly given = {
    runtime: (runtime: AtlasHostRuntimeConfig): ValidationDriver => {
      this.runtime = runtime;

      return this;
    },
    catalog: (catalog: AtlasHostCatalog): ValidationDriver => {
      this.catalog = catalog;

      return this;
    },
    manifest: (
      manifest: AtlasHostManifest | AtlasManifest,
    ): ValidationDriver => {
      this.manifest = manifest;

      return this;
    },
    url: (url: URL): ValidationDriver => {
      this.url = url;

      return this;
    },
  };

  readonly when = {
    catalogValidated: (): void => {
      try {
        validateCatalog({ runtime: this.runtime, catalog: this.catalog });
      } catch (error) {
        this.error = error;
      }
    },
    hostManifestValidated: (): void => {
      try {
        validateHostManifest({
          manifest: this.manifest as AtlasHostManifest,
          runtime: this.runtime,
        });
      } catch (error) {
        this.error = error;
      }
    },
    artifactUrlValidated: (): void => {
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
    error: (): unknown => this.error,
  };
}
