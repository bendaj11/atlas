import type { ArtifactVersion } from '../../types/artifact-version';
import type { HostData } from '../../types/host-data';
import { aHostData } from '../../types/host-data.testkit';
import {
  extractEnabledArtifactVersionOverrides,
  includeOverrideAppsInCatalog,
} from './override-artifact-versions';

export class OverrideArtifactVersionsDriver {
  private hostData: HostData = aHostData();
  private extracted: Map<string, ArtifactVersion> | undefined;
  private catalog: HostData['catalog'] | undefined;

  readonly given = {
    hostData: (hostData: HostData): this => {
      this.hostData = hostData;

      return this;
    },
  };

  readonly when = {
    activeOverridesExtracted: (): void => {
      this.extracted = extractEnabledArtifactVersionOverrides(this.hostData);
    },
    overrideAppsIncluded: (
      overrideArtifactVersions: ArtifactVersion[],
    ): void => {
      this.catalog = includeOverrideAppsInCatalog({
        hostData: this.hostData,
        overrideArtifactVersions,
      }).catalog;
    },
  };

  readonly get = {
    extractedKeys: (): string[] => [...(this.extracted?.keys() ?? [])],
    extracted: (key: string): ArtifactVersion | undefined =>
      this.extracted?.get(key),
    catalogAppIds: (): string[] =>
      this.catalog?.apps.map((manifest) => manifest.id) ?? [],
    catalogWidgetProviderIds: (): string[] =>
      this.catalog?.widgetProviders?.map((manifest) => manifest.id) ?? [],
  };
}
