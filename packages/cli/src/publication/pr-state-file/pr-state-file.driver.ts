import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import {
  type AtlasArtifactPreviewState,
  type PullRequestStateDependencies,
  readOpenPreviews,
} from './pr-state-file.js';

type StateScenario =
  'complete' | 'duplicate-artifact' | 'incomplete' | 'unsafe-artifact';

export class PullRequestStateDriver {
  private readonly path = faker.system.filePath();
  private readonly previews = faker.helpers.uniqueArray(
    () => faker.number.int({ min: 1, max: 10_000 }),
    2,
  );
  private readonly appId = faker.string.uuid();
  private readonly hostId = faker.string.uuid();
  private readonly readState =
    jest.fn<PullRequestStateDependencies['readState']>();
  private result?: readonly AtlasArtifactPreviewState[];

  readonly given = {
    state: (scenario: StateScenario): void => {
      this.readState.mockResolvedValue(
        JSON.stringify({
          schemaVersion: '1',
          ...(scenario !== 'incomplete' ? { complete: true } : {}),
          artifacts: [
            {
              kind: 'app',
              id: scenario === 'unsafe-artifact' ? '../apps' : this.appId,
              openPreviews: this.previews,
            },
            {
              kind: scenario === 'duplicate-artifact' ? 'app' : 'host',
              id: scenario === 'duplicate-artifact' ? this.appId : this.hostId,
              openPreviews: [],
            },
          ],
        }),
      );
    },
  };

  readonly when = {
    read: async (): Promise<void> => {
      this.result = await readOpenPreviews(this.path, {
        readState: this.readState,
      });
    },
  };

  readonly get = {
    result: (): readonly AtlasArtifactPreviewState[] => {
      if (!this.result)
        throw new Error('Pull-request state was not available.');

      return this.result;
    },
    expectedState: (): readonly AtlasArtifactPreviewState[] => [
      { kind: 'app', id: this.appId, openPreviews: new Set(this.previews) },
      { kind: 'host', id: this.hostId, openPreviews: new Set() },
    ],
  };
}
