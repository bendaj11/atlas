import type { AtlasExtensionManifest } from '../../../types/contracts';
import { uniqueVersions, versionKey } from './manifest-versions';

export class ManifestVersionsDriver {
  private versions: AtlasExtensionManifest[] = [];

  readonly given = {
    version: (version: AtlasExtensionManifest): this => {
      this.versions.push(version);

      return this;
    },
  };

  readonly get = {
    uniqueVersionKeys: (): string[] =>
      uniqueVersions(this.versions).map((manifest) => versionKey(manifest)),
    versionKey: (manifest: AtlasExtensionManifest): string =>
      versionKey(manifest),
  };
}
