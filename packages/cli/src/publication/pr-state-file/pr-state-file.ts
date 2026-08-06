import { readFile } from 'node:fs/promises';

interface AtlasPullRequestStateFile {
  schemaVersion: '1';
  complete: true;
  openPullRequests: number[];
}

export interface PullRequestStateDependencies {
  readState(path: string): Promise<string>;
}

const defaultDependencies: PullRequestStateDependencies = {
  readState: async (path) => readFile(path, 'utf8'),
};

export async function readOpenPullRequests(
  path: string,
  dependencies = defaultDependencies,
): Promise<ReadonlySet<number>> {
  let value: unknown;

  try {
    value = JSON.parse(await dependencies.readState(path));
  } catch (error) {
    throw new Error(
      `Atlas could not read the authoritative PR state file "${path}".`,
      { cause: error },
    );
  }

  if (!isPullRequestStateFile(value)) {
    throw new Error(
      `Atlas PR state file "${path}" must contain { "schemaVersion": "1", "complete": true, "openPullRequests": [1, 2] }.`,
    );
  }

  return new Set(value.openPullRequests);
}

function isPullRequestStateFile(
  value: unknown,
): value is AtlasPullRequestStateFile {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Partial<AtlasPullRequestStateFile>;
  return (
    state.schemaVersion === '1' &&
    state.complete === true &&
    Array.isArray(state.openPullRequests) &&
    state.openPullRequests.every(
      (number) => Number.isSafeInteger(number) && number > 0,
    )
  );
}
