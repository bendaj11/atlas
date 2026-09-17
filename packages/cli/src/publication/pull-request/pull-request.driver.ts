import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type {
  AtlasPreviewHeadStatus,
  AtlasRegistryConfig,
} from '../registry-config/types.js';
import { resolvePullRequestStatus } from './pull-request.js';

const PROVIDER_ENVIRONMENT_VARIABLES = [
  'ATLAS_GIT_TOKEN',
  'GITHUB_REPOSITORY',
  'GITHUB_TOKEN',
  'GITHUB_API_URL',
  'CI_PROJECT_ID',
  'CI_API_V4_URL',
  'CI_JOB_TOKEN',
  'BITBUCKET_REPO_FULL_NAME',
  'BITBUCKET_ACCESS_TOKEN',
] as const;

export class PullRequestDriver {
  private readonly fetch = jest.fn<typeof globalThis.fetch>();
  private readonly originalFetch = globalThis.fetch;
  private readonly originalEnvironment = new Map(
    PROVIDER_ENVIRONMENT_VARIABLES.map((name) => [name, process.env[name]]),
  );
  private prNumber = faker.number.int({ min: 1 });
  private config?: AtlasRegistryConfig;
  private status?: AtlasPreviewHeadStatus;

  constructor() {
    Object.assign(globalThis, { fetch: this.fetch });

    for (const name of PROVIDER_ENVIRONMENT_VARIABLES) delete process.env[name];
  }

  readonly given = {
    prNumber: (prNumber: number) => {
      this.prNumber = prNumber;

      return this;
    },
    environment: (variables: Record<string, string>) => {
      Object.assign(process.env, variables);

      return this;
    },
    config: (config: AtlasRegistryConfig) => {
      this.config = config;

      return this;
    },
    providerResponse: (body: unknown) => {
      this.fetch.mockResolvedValue(Response.json(body));

      return this;
    },
    providerResponseStatus: (status: number) => {
      this.fetch.mockResolvedValue(new Response(null, { status }));

      return this;
    },
    providerFailure: (error: Error) => {
      this.fetch.mockRejectedValue(error);

      return this;
    },
  };

  readonly when = {
    resolve: async () => {
      try {
        this.status = await resolvePullRequestStatus(
          {
            artifactId: faker.string.uuid(),
            gitSha: faker.git.commitSha(),
            prNumber: this.prNumber,
          },
          this.config,
        );
      } finally {
        globalThis.fetch = this.originalFetch;

        for (const [name, value] of this.originalEnvironment) {
          if (value === undefined) delete process.env[name];
          else process.env[name] = value;
        }
      }
    },
  };

  readonly get = {
    request: () => {
      const [url, options] = this.fetch.mock.calls[0] ?? [];
      const headers = new Headers(options?.headers);

      return { url, headers: Object.fromEntries(headers.entries()) };
    },
    status: () => this.status,
  };
}
