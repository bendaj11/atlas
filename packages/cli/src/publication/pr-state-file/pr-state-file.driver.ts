import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import {
  type PullRequestStateDependencies,
  readOpenPullRequests,
} from './pr-state-file.js';

type StateScenario = 'complete' | 'incomplete';

export class PullRequestStateDriver {
  private readonly path = faker.system.filePath();
  private readonly pullRequests = faker.helpers.multiple(
    () => faker.number.int({ min: 1, max: 10_000 }),
    { count: 2 },
  );
  private readonly readState =
    jest.fn<PullRequestStateDependencies['readState']>();
  private result?: ReadonlySet<number>;

  readonly given = {
    state: (scenario: StateScenario): void => {
      this.readState.mockResolvedValue(
        JSON.stringify({
          schemaVersion: '1',
          ...(scenario === 'complete' ? { complete: true } : {}),
          openPullRequests: this.pullRequests,
        }),
      );
    },
  };

  readonly when = {
    read: async (): Promise<void> => {
      this.result = await readOpenPullRequests(this.path, {
        readState: this.readState,
      });
    },
  };

  readonly get = {
    result: (): ReadonlySet<number> => {
      if (!this.result)
        throw new Error('Pull-request state was not available.');

      return this.result;
    },
    expectedPullRequests: (): ReadonlySet<number> => new Set(this.pullRequests),
  };
}
