import type { AtlasManifest } from '@atlas/schema';
import { aHostCatalog } from '@atlas/testkit';
import { createRegistryWidgetResolver } from './widget-registry.js';
import type {
  AtlasResolvedWidget,
  AtlasWidgetResolver,
} from './widget-loader.types.js';

export class WidgetRegistryDriver {
  private apps: AtlasManifest[] = [];
  private widgetProviders: AtlasManifest[] = [];
  private resolver: AtlasWidgetResolver | undefined;
  private resolved: AtlasResolvedWidget | undefined;
  private error: unknown;

  readonly given = {
    apps: (apps: AtlasManifest[]) => {
      this.apps = apps;

      return this;
    },
    widgetProviders: (widgetProviders: AtlasManifest[]) => {
      this.widgetProviders = widgetProviders;

      return this;
    },
  };

  readonly when = {
    created: () => {
      try {
        this.resolver = createRegistryWidgetResolver({
          catalog: aHostCatalog({
            apps: this.apps,
            widgetProviders: this.widgetProviders,
          }),
        });
      } catch (error) {
        this.error = error;
      }
    },
    resolved: async (widgetId: string) => {
      try {
        this.resolved = await this.resolver!(widgetId);
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    resolved: () => this.resolved!,
    error: () => this.error,
  };
}
