import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasPublishConfig } from '../publish-config.js';
import type {
  AtlasPullRequestLookup,
  AtlasPullRequestStatus,
} from '../publish-config.js';
import { resolvePullRequestStatus } from './pull-request.js';

export class PullRequestDriver {
  private readonly artifactId = faker.string.uuid();
  private readonly headSha = faker.git.commitSha();
  private readonly owner = faker.internet.username().toLowerCase();
  private readonly repositoryName = faker.word.noun().toLowerCase();
  private readonly token = faker.string.alphanumeric();
  private readonly prNumber = faker.number.int({ min: 1 });
  private readonly fetch = jest.fn<typeof globalThis.fetch>();
  private readonly originalFetch = globalThis.fetch;
  private readonly originalRepository = process.env.GITHUB_REPOSITORY;
  private readonly originalToken = process.env.GITHUB_TOKEN;
  private config?: AtlasPublishConfig;
  private status?: AtlasPullRequestStatus;

  constructor() {
    Object.assign(globalThis, { fetch: this.fetch });

    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_TOKEN;
  }

  given = {
    github: ({ state }: { state: 'open' }): void => {
      Object.assign(process.env, {
        GITHUB_REPOSITORY: `${this.owner}/${this.repositoryName}`,
        GITHUB_TOKEN: this.token,
      });

      this.fetch.mockResolvedValue(
        Response.json({
          head: { sha: this.headSha },
          merged_at: null,
          state,
        }),
      );
    },
    resolver: ({ headSha }: { headSha: 'empty' }): void => {
      this.status = undefined;
      this.fetch.mockReset();
      this.config = {
        resolvePullRequest: async () => ({
          headSha: headSha === 'empty' ? '' : this.headSha,
          state: 'open',
        }),
      };
    },
  };

  when = {
    resolve: async (): Promise<void> => {
      try {
        this.status = await resolvePullRequestStatus(this.lookup, this.config);
      } finally {
        globalThis.fetch = this.originalFetch;
        this.restoreEnvironment('GITHUB_REPOSITORY', this.originalRepository);
        this.restoreEnvironment('GITHUB_TOKEN', this.originalToken);
      }
    },
  };

  get = {
    request: (): { authorization: string | null; url: unknown } => {
      const [url, options] = this.fetch.mock.calls[0] ?? [];
      const headers = new Headers(options?.headers);

      return {
        authorization: headers.get('Authorization'),
        url,
      };
    },
    status: (): AtlasPullRequestStatus | undefined => this.status,
    expectedOpenStatus: (): AtlasPullRequestStatus => ({
      headSha: this.headSha,
      state: 'open',
    }),
    expectedRequest: (): { authorization: string; url: string } => ({
      authorization: `Bearer ${this.token}`,
      url: `https://api.github.com/repos/${this.owner}/${this.repositoryName}/pulls/${this.prNumber}`,
    }),
  };

  private readonly lookup: AtlasPullRequestLookup = {
    artifactId: this.artifactId,
    gitSha: this.headSha,
    prNumber: this.prNumber,
  };

  private restoreEnvironment(name: string, value: string | undefined): void {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
