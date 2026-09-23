import { faker } from '@faker-js/faker';
import type { AtlasHostCatalog, AtlasManifest } from '@atlas/schema';
import { aHostCatalog } from '@atlas/testkit';
import type { AtlasRuntimeOverride } from '../overrides/overrides.types.js';
import { resolveRuntimeCatalog } from './catalog-resolution.js';

export class CatalogResolutionDriver {
  private hostId = faker.string.uuid();
  private apps: AtlasManifest[] = [];
  private widgetProviders: AtlasManifest[] | undefined;
  private overrides: AtlasRuntimeOverride[] = [];
  private resolved: AtlasHostCatalog | undefined;
  private error: unknown;

  readonly given = {
    hostId: (hostId: string) => {
      this.hostId = hostId;

      return this;
    },
    apps: (apps: AtlasManifest[]) => {
      this.apps = apps;

      return this;
    },
    widgetProviders: (widgetProviders: AtlasManifest[]) => {
      this.widgetProviders = widgetProviders;

      return this;
    },
    overrides: (overrides: AtlasRuntimeOverride[]) => {
      this.overrides = overrides;

      return this;
    },
  };

  readonly when = {
    resolved: () => {
      try {
        this.resolved = resolveRuntimeCatalog(
          aHostCatalog({
            hostId: this.hostId,
            apps: this.apps,
            ...(this.widgetProviders
              ? { widgetProviders: this.widgetProviders }
              : {}),
          }),
          this.overrides,
        );
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    apps: () => this.resolved!.apps,
    widgetProviders: () => this.resolved!.widgetProviders,
    error: () => this.error,
  };
}
