import { afterEach, expect, jest, test } from "@jest/globals";
import { resolvePullRequestStatus } from "../dist/pull-request.js";

const originalFetch = globalThis.fetch;
const originalRepository = process.env.GITHUB_REPOSITORY;
const originalToken = process.env.GITHUB_TOKEN;

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnvironment("GITHUB_REPOSITORY", originalRepository);
  restoreEnvironment("GITHUB_TOKEN", originalToken);
});

test("GitHub resolver reads the live pull-request head", async () => {
  process.env.GITHUB_REPOSITORY = "acme/storefront";
  process.env.GITHUB_TOKEN = "test-token";
  const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(Response.json({
    state: "open",
    merged_at: null,
    head: { sha: "live-sha" }
  }));
  globalThis.fetch = fetchMock;

  const status = await resolvePullRequestStatus({
    artifactId: "orders",
    prNumber: 42,
    gitSha: "live-sha"
  }, undefined);

  expect(status).toStrictEqual({ state: "open", headSha: "live-sha" });
  expect(fetchMock).toHaveBeenCalledWith(
    "https://api.github.com/repos/acme/storefront/pulls/42",
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-token" }) })
  );
});

test("custom resolvers must return a valid state and head SHA", async () => {
  await expect(resolvePullRequestStatus({
    artifactId: "orders",
    prNumber: 42,
    gitSha: "built-sha"
  }, {
    resolvePullRequest: async () => ({ state: "open", headSha: "" })
  })).rejects.toThrow(/invalid state or empty head SHA/);
});

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
