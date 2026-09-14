import type { Artifact } from '../../../../types/app.js';
import { createArtifact } from '../../../../types/app.testkit.js';
import { filterArtifacts } from './filterArtifacts.js';

export class FilterArtifactsDriver {
  private artifacts: Artifact[] = [];
  private searchValue = '';
  private visibleOnly = false;
  private result: ReturnType<typeof filterArtifacts> | undefined;

  readonly given = {
    artifact: (overrides: Partial<Artifact>): Artifact => {
      const artifact = createArtifact(overrides);
      this.artifacts.push(artifact);

      return artifact;
    },
    searchValue: (searchValue: string): this => {
      this.searchValue = searchValue;

      return this;
    },
    visibleOnly: (): this => {
      this.visibleOnly = true;

      return this;
    },
  };

  readonly when = {
    filtered: (): this => {
      this.result = filterArtifacts({
        artifacts: this.artifacts,
        searchValue: this.searchValue,
        visibleOnly: this.visibleOnly,
      });

      return this;
    },
  };

  readonly get = {
    artifacts: (): Artifact[] => this.result!.artifacts,
    totalCount: (): number => this.result!.totalCount,
  };
}
