import type { ArtifactVersion } from '../../../types/artifact-version';
import { uniqueVersions, versionKey } from './artifact-version-keys';

export class ArtifactVersionKeysDriver {
  private versions: ArtifactVersion[] = [];

  readonly given = {
    version: (version: ArtifactVersion): this => {
      this.versions.push(version);

      return this;
    },
  };

  readonly get = {
    uniqueVersionKeys: (): string[] =>
      uniqueVersions(this.versions).map((manifest) => versionKey(manifest)),
    versionKey: (manifest: ArtifactVersion): string => versionKey(manifest),
  };
}
