import { faker } from '@faker-js/faker';
import { PullRequestDriver } from './pull-request.driver.js';

const GITHUB_STATES = [
  { state: 'open', mergedAt: null, expected: 'open' },
  { state: 'closed', mergedAt: null, expected: 'closed' },
  { state: 'closed', mergedAt: '2024-01-01T00:00:00Z', expected: 'merged' },
] as const;
const GITLAB_STATES = [
  { state: 'opened', expected: 'open' },
  { state: 'closed', expected: 'closed' },
  { state: 'merged', expected: 'merged' },
] as const;
const BITBUCKET_STATES = [
  { state: 'OPEN', expected: 'open' },
  { state: 'DECLINED', expected: 'closed' },
  { state: 'MERGED', expected: 'merged' },
] as const;

describe('resolvePullRequestStatus', () => {
  let driver: PullRequestDriver;

  beforeEach(() => {
    driver = new PullRequestDriver();
  });

  it('should reject when no provider is configured', async () => {
    await expect(driver.when.resolve()).rejects.toThrow(
      /cannot verify the live preview head/,
    );
  });

  describe('when a custom resolver is configured', () => {
    it('should return resolver status when it reports a head SHA', async () => {
      const status = { headSha: faker.git.commitSha(), state: 'open' } as const;
      driver.given.config({ resolvePreviewHead: async () => status });

      await driver.when.resolve();

      expect(driver.get.status()).toStrictEqual(status);
    });

    it('should reject when resolver reports an empty head SHA', async () => {
      driver.given.config({
        resolvePreviewHead: async () => ({ headSha: '', state: 'open' }),
      });

      await expect(driver.when.resolve()).rejects.toThrow(
        /invalid state or empty head SHA/,
      );
    });
  });

  describe('when GitHub repository is configured', () => {
    const repository = `${faker.internet.username().toLowerCase()}/${faker.word.noun()}`;
    const token = faker.string.alphanumeric(20);
    const headSha = faker.git.commitSha();
    const prNumber = faker.number.int({ min: 1 });

    beforeEach(() => {
      driver.given
        .prNumber(prNumber)
        .given.environment({
          GITHUB_REPOSITORY: repository,
          GITHUB_TOKEN: token,
        });
    });

    it.each(GITHUB_STATES)(
      'should return $expected when GitHub reports state $state with merged_at $mergedAt',
      async ({ state, mergedAt, expected }) => {
        driver.given.providerResponse({
          head: { sha: headSha },
          merged_at: mergedAt,
          state,
        });

        await driver.when.resolve();

        expect(driver.get.status()).toStrictEqual({ headSha, state: expected });
      },
    );

    it('should request the pull request with a bearer token', async () => {
      driver.given.providerResponse({ head: { sha: headSha }, state: 'open' });

      await driver.when.resolve();

      expect(driver.get.request()).toStrictEqual({
        url: `https://api.github.com/repos/${repository}/pulls/${prNumber}`,
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${token}`,
          'x-github-api-version': '2022-11-28',
        },
      });
    });

    it('should request the custom API URL when GITHUB_API_URL is set', async () => {
      const apiUrl = faker.internet.url({ appendSlash: false });
      driver.given
        .environment({ GITHUB_API_URL: apiUrl })
        .given.providerResponse({ head: { sha: headSha }, state: 'open' });

      await driver.when.resolve();

      expect(driver.get.request().url).toBe(
        `${apiUrl}/repos/${repository}/pulls/${prNumber}`,
      );
    });

    it('should reject when GitHub reports no head SHA', async () => {
      driver.given.providerResponse({ state: 'open' });

      await expect(driver.when.resolve()).rejects.toThrow(
        /received no GitHub pull-request head SHA/,
      );
    });

    it('should reject when GitHub responds with an error status', async () => {
      driver.given.providerResponseStatus(404);

      await expect(driver.when.resolve()).rejects.toThrow(
        /api\.github\.com: HTTP 404/,
      );
    });

    it('should reject when the GitHub request fails', async () => {
      driver.given.providerFailure(new Error(faker.lorem.sentence()));

      await expect(driver.when.resolve()).rejects.toThrow(
        /could not query pull-request state from api\.github\.com\./,
      );
    });
  });

  describe('when GitHub repository is configured without a token', () => {
    beforeEach(() => {
      driver.given.environment({ GITHUB_REPOSITORY: faker.word.noun() });
    });

    it('should reject when neither ATLAS_GIT_TOKEN nor GITHUB_TOKEN is set', async () => {
      await expect(driver.when.resolve()).rejects.toThrow(
        /needs ATLAS_GIT_TOKEN or GITHUB_TOKEN/,
      );
    });

    it('should authenticate with ATLAS_GIT_TOKEN when it is set', async () => {
      const token = faker.string.alphanumeric(20);
      driver.given
        .environment({ ATLAS_GIT_TOKEN: token })
        .given.providerResponse({
          head: { sha: faker.git.commitSha() },
          state: 'open',
        });

      await driver.when.resolve();

      expect(driver.get.request().headers.authorization).toBe(
        `Bearer ${token}`,
      );
    });
  });

  describe('when GitLab project is configured', () => {
    const projectId = `${faker.word.noun()}/${faker.word.noun()}`;
    const apiUrl = faker.internet.url({ appendSlash: false });
    const jobToken = faker.string.alphanumeric(20);
    const headSha = faker.git.commitSha();
    const prNumber = faker.number.int({ min: 1 });

    beforeEach(() => {
      driver.given.prNumber(prNumber).given.environment({
        CI_PROJECT_ID: projectId,
        CI_API_V4_URL: apiUrl,
        CI_JOB_TOKEN: jobToken,
      });
    });

    it.each(GITLAB_STATES)(
      'should return $expected when GitLab reports state $state',
      async ({ state, expected }) => {
        driver.given.providerResponse({ sha: headSha, state });

        await driver.when.resolve();

        expect(driver.get.status()).toStrictEqual({ headSha, state: expected });
      },
    );

    it('should request the merge request with the job token', async () => {
      driver.given.providerResponse({ sha: headSha, state: 'opened' });

      await driver.when.resolve();

      expect(driver.get.request()).toStrictEqual({
        url: `${apiUrl}/projects/${encodeURIComponent(projectId)}/merge_requests/${prNumber}`,
        headers: { 'job-token': jobToken },
      });
    });

    it('should send ATLAS_GIT_TOKEN as a private token when it is set', async () => {
      const token = faker.string.alphanumeric(20);
      driver.given
        .environment({ ATLAS_GIT_TOKEN: token })
        .given.providerResponse({ sha: headSha, state: 'opened' });

      await driver.when.resolve();

      expect(driver.get.request().headers).toStrictEqual({
        'private-token': token,
      });
    });

    it('should reject when GitLab reports no head SHA', async () => {
      driver.given.providerResponse({ state: 'opened' });

      await expect(driver.when.resolve()).rejects.toThrow(
        /received no GitLab merge-request head SHA/,
      );
    });
  });

  describe('when Bitbucket repository is configured', () => {
    const repository = `${faker.word.noun()}/${faker.word.noun()}`;
    const token = faker.string.alphanumeric(20);
    const headSha = faker.git.commitSha();
    const prNumber = faker.number.int({ min: 1 });

    beforeEach(() => {
      driver.given.prNumber(prNumber).given.environment({
        BITBUCKET_REPO_FULL_NAME: repository,
        BITBUCKET_ACCESS_TOKEN: token,
      });
    });

    it.each(BITBUCKET_STATES)(
      'should return $expected when Bitbucket reports state $state',
      async ({ state, expected }) => {
        driver.given.providerResponse({
          source: { commit: { hash: headSha } },
          state,
        });

        await driver.when.resolve();

        expect(driver.get.status()).toStrictEqual({ headSha, state: expected });
      },
    );

    it('should request the pull request with a bearer token', async () => {
      driver.given.providerResponse({
        source: { commit: { hash: headSha } },
        state: 'OPEN',
      });

      await driver.when.resolve();

      expect(driver.get.request()).toStrictEqual({
        url: `https://api.bitbucket.org/2.0/repositories/${repository}/pullrequests/${prNumber}`,
        headers: { authorization: `Bearer ${token}` },
      });
    });

    it('should reject when Bitbucket reports no head SHA', async () => {
      driver.given.providerResponse({ state: 'OPEN' });

      await expect(driver.when.resolve()).rejects.toThrow(
        /received no Bitbucket pull-request head SHA/,
      );
    });
  });
});
