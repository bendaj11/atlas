import type {
  AtlasPublishConfig,
  AtlasPullRequestLookup,
  AtlasPullRequestStatus
} from "./publish-config.js";

export async function resolvePullRequestStatus(
  pullRequest: AtlasPullRequestLookup,
  config: AtlasPublishConfig | undefined
): Promise<AtlasPullRequestStatus> {
  let status: AtlasPullRequestStatus;
  if (config?.resolvePullRequest) status = await config.resolvePullRequest(pullRequest);
  else if (process.env.GITHUB_REPOSITORY) status = await resolveGitHubPullRequest(pullRequest.prNumber);
  else if (process.env.CI_PROJECT_ID && process.env.CI_API_V4_URL) status = await resolveGitLabMergeRequest(pullRequest.prNumber);
  else if (process.env.BITBUCKET_REPO_FULL_NAME) status = await resolveBitbucketPullRequest(pullRequest.prNumber);
  else {
    throw new Error(
      "Atlas cannot verify the live pull-request head. Run in GitHub, GitLab, or Bitbucket CI with its standard repository variables, or configure resolvePullRequest in atlas.publish.ts."
    );
  }
  if (!(["open", "closed", "merged"] as const).includes(status.state) || !status.headSha?.trim()) {
    throw new Error("Atlas pull-request resolver returned an invalid state or empty head SHA.");
  }
  return status;
}

async function resolveGitHubPullRequest(prNumber: number): Promise<AtlasPullRequestStatus> {
  const repository = process.env.GITHUB_REPOSITORY!;
  const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
  const token = providerToken("GITHUB_TOKEN");
  const response = await providerFetch(`${apiUrl}/repos/${repository}/pulls/${prNumber}`, {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  });
  const data = response as { state?: string; merged_at?: string | null; head?: { sha?: string } };
  return {
    state: data.merged_at ? "merged" : data.state === "open" ? "open" : "closed",
    headSha: requiredString(data.head?.sha, "GitHub pull-request head SHA")
  };
}

async function resolveGitLabMergeRequest(prNumber: number): Promise<AtlasPullRequestStatus> {
  const project = encodeURIComponent(process.env.CI_PROJECT_ID!);
  const token = providerToken("CI_JOB_TOKEN");
  const tokenHeader = process.env.ATLAS_GIT_TOKEN ? "PRIVATE-TOKEN" : "JOB-TOKEN";
  const response = await providerFetch(
    `${process.env.CI_API_V4_URL}/projects/${project}/merge_requests/${prNumber}`,
    { [tokenHeader]: token }
  );
  const data = response as { state?: string; sha?: string };
  return {
    state: data.state === "opened" ? "open" : data.state === "merged" ? "merged" : "closed",
    headSha: requiredString(data.sha, "GitLab merge-request head SHA")
  };
}

async function resolveBitbucketPullRequest(prNumber: number): Promise<AtlasPullRequestStatus> {
  const repository = process.env.BITBUCKET_REPO_FULL_NAME!;
  const token = providerToken("BITBUCKET_ACCESS_TOKEN");
  const response = await providerFetch(
    `https://api.bitbucket.org/2.0/repositories/${repository}/pullrequests/${prNumber}`,
    { Authorization: `Bearer ${token}` }
  );
  const data = response as { state?: string; source?: { commit?: { hash?: string } } };
  return {
    state: data.state === "OPEN" ? "open" : data.state === "MERGED" ? "merged" : "closed",
    headSha: requiredString(data.source?.commit?.hash, "Bitbucket pull-request head SHA")
  };
}

async function providerFetch(url: string, headers: Record<string, string>): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { headers });
  } catch (error) {
    throw new Error(`Atlas could not query pull-request state from ${new URL(url).host}.`, { cause: error });
  }
  if (!response.ok) {
    throw new Error(`Atlas could not query pull-request state from ${new URL(url).host}: HTTP ${response.status}.`);
  }
  return response.json();
}

function providerToken(providerVariable: string): string {
  const token = process.env.ATLAS_GIT_TOKEN ?? process.env[providerVariable];
  if (!token) {
    throw new Error(`Atlas needs ATLAS_GIT_TOKEN or ${providerVariable} to verify the live pull-request head.`);
  }
  return token;
}

function requiredString(value: string | undefined, subject: string): string {
  if (!value) throw new Error(`Atlas received no ${subject} from the Git provider.`);
  return value;
}
