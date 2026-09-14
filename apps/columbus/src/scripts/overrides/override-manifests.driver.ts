import type {
  AtlasExtensionManifest as Manifest,
  AtlasHostData as HostData,
} from '../../types/contracts';
import { aHostData } from '../../types/app.testkit';
import {
  extractActiveOverrideManifests,
  includeOverrideAppsInCatalog,
} from './override-manifests';

export class OverrideManifestsDriver {
  private hostData: HostData = aHostData();
  private extracted: Map<string, Manifest> | undefined;
  private catalog: HostData['catalog'] | undefined;

  readonly given = {
    hostData: (hostData: HostData): this => {
      this.hostData = hostData;

      return this;
    },
  };

  readonly when = {
    activeOverridesExtracted: (): this => {
      this.extracted = extractActiveOverrideManifests(this.hostData);

      return this;
    },
    overrideAppsIncluded: (overrideManifests: Manifest[]): this => {
      this.catalog = includeOverrideAppsInCatalog({
        hostData: this.hostData,
        overrideManifests,
      }).catalog;

      return this;
    },
  };

  readonly get = {
    extractedKeys: (): string[] => [...(this.extracted?.keys() ?? [])],
    extracted: (key: string): Manifest | undefined => this.extracted?.get(key),
    catalogAppIds: (): string[] =>
      this.catalog?.apps.map((manifest) => manifest.id) ?? [],
    catalogWidgetProviderIds: (): string[] =>
      this.catalog?.widgetProviders?.map((manifest) => manifest.id) ?? [],
  };
}
