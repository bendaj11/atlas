import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import {
  type AtlasArtifactPreviewState,
  type PullRequestStateDependencies,
  readOpenPreviews,
} from './pr-state-file.js';

export class PullRequestStateDriver {
  private readonly path = faker.system.filePath();
  private readonly readState =
    jest.fn<PullRequestStateDependencies['readState']>();

  readonly given = {
    stateFile: (contents: unknown): this => {
      this.readState.mockResolvedValue(
        typeof contents === 'string' ? contents : JSON.stringify(contents),
      );

      return this;
    },
    unreadableStateFile: (): this => {
      this.readState.mockRejectedValue(new Error('ENOENT'));

      return this;
    },
  };

  readonly get = {
    previews: (): Promise<readonly AtlasArtifactPreviewState[]> =>
      readOpenPreviews(this.path, { readState: this.readState }),
    path: (): string => this.path,
  };
}
