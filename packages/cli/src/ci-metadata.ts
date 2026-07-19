export function firstEnvironmentValue(names: readonly string[]): string | undefined {
  return names.map((name) => process.env[name]).find((value) => Boolean(value));
}

export function inferredPullRequestNumber(): string | undefined {
  const explicit = firstEnvironmentValue([
    "ATLAS_PR_NUMBER", "PR_NUMBER", "GITHUB_PR_NUMBER", "CI_MERGE_REQUEST_IID",
    "BITBUCKET_PR_ID", "VERCEL_GIT_PULL_REQUEST_ID"
  ]);
  if (explicit) return explicit;
  return process.env.GITHUB_REF?.match(/^refs\/pull\/(\d+)\//)?.[1]
    ?? process.env.GITHUB_REF_NAME?.match(/^(\d+)\//)?.[1];
}

export function inferredGitSha(): string | undefined {
  return firstEnvironmentValue([
    "ATLAS_GIT_SHA", "GIT_SHA", "GITHUB_HEAD_SHA", "GITHUB_SHA", "CI_COMMIT_SHA",
    "BITBUCKET_COMMIT", "VERCEL_GIT_COMMIT_SHA"
  ]);
}

export function inferredGitBranch(): string | undefined {
  return firstEnvironmentValue([
    "ATLAS_GIT_BRANCH", "GITHUB_HEAD_REF", "CI_MERGE_REQUEST_SOURCE_BRANCH_NAME",
    "GITHUB_REF_NAME", "CI_COMMIT_BRANCH", "CI_COMMIT_REF_NAME", "BITBUCKET_BRANCH",
    "VERCEL_GIT_COMMIT_REF", "BRANCH_NAME", "GIT_BRANCH"
  ]);
}

export function inferredGitCommitTitle(): string | undefined {
  return firstEnvironmentValue(["ATLAS_GIT_COMMIT_TITLE", "CI_COMMIT_TITLE"]);
}

export function inferredGitTag(): string | undefined {
  return process.env.CI_COMMIT_TAG
    ?? (process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined);
}

export function inferredDefaultBranch(): string | undefined {
  return firstEnvironmentValue([
    "ATLAS_DEFAULT_BRANCH", "CI_DEFAULT_BRANCH", "BITBUCKET_PR_DESTINATION_BRANCH"
  ]);
}

export function publicationRequired(): boolean {
  return ["1", "true", "yes"].includes((process.env.ATLAS_REQUIRE_PUBLICATION ?? "").toLowerCase());
}
