import { readFile } from "node:fs/promises";

interface AtlasPullRequestStateFile {
  schemaVersion: "1";
  complete: true;
  openPullRequests: number[];
}

export async function readOpenPullRequests(path: string): Promise<ReadonlySet<number>> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`Atlas could not read the authoritative PR state file "${path}".`, { cause: error });
  }
  if (!isPullRequestStateFile(value)) {
    throw new Error(
      `Atlas PR state file "${path}" must contain { "schemaVersion": "1", "complete": true, "openPullRequests": [1, 2] }.`
    );
  }
  return new Set(value.openPullRequests);
}

function isPullRequestStateFile(value: unknown): value is AtlasPullRequestStateFile {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<AtlasPullRequestStateFile>;
  return state.schemaVersion === "1" && state.complete === true && Array.isArray(state.openPullRequests)
    && state.openPullRequests.every((number) => Number.isSafeInteger(number) && number > 0);
}
