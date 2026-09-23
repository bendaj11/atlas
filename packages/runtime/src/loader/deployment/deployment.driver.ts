import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import type {
  AtlasHostCatalog,
  AtlasHostDeploymentManifest,
} from '@atlas/schema';
import { encodeTextAsBytes } from '../../shared/bytes.testkit.js';
import type { FetchBytes } from '../fetch-bytes.js';
import { loadHostDeployment } from './deployment.js';

export class DeploymentDriver {
  private readonly manifestUrl = faker.internet.url();
  private artifactRegistryUrl: string | undefined;
  private expectedHostId: string | undefined;
  private expectedEnvironment: string | undefined;
  private readonly responses = new Map<string, ArrayBuffer>();
  private readonly fetchBytes = jest.fn<FetchBytes>(async (url) => {
    const bytes = this.responses.get(url);

    if (!bytes) throw new Error(`Unexpected fetch: ${url}`);

    return bytes;
  });
  private catalog: AtlasHostCatalog | undefined;
  private error: unknown;

  readonly given = {
    artifactRegistryUrl: (url: string) => {
      this.artifactRegistryUrl = url;

      return this;
    },
    expectedHostId: (hostId: string) => {
      this.expectedHostId = hostId;

      return this;
    },
    expectedEnvironment: (environment: string) => {
      this.expectedEnvironment = environment;

      return this;
    },
    deployment: (deployment: AtlasHostDeploymentManifest) => {
      this.responses.set(
        this.manifestUrl,
        encodeTextAsBytes(JSON.stringify(deployment)),
      );

      return this;
    },
    deploymentText: (text: string) => {
      this.responses.set(this.manifestUrl, encodeTextAsBytes(text));

      return this;
    },
    artifactAt: (url: string, artifact: unknown) => {
      this.responses.set(url, encodeTextAsBytes(JSON.stringify(artifact)));

      return this;
    },
  };

  readonly when = {
    loaded: async () => {
      try {
        this.catalog = await loadHostDeployment({
          manifestUrl: this.manifestUrl,
          fetchBytes: this.fetchBytes,
          requestPolicy: { retryCount: 0, timeoutMs: 1_000 },
          ...(this.artifactRegistryUrl
            ? { artifactRegistryUrl: this.artifactRegistryUrl }
            : {}),
          ...(this.expectedHostId
            ? { expectedHostId: this.expectedHostId }
            : {}),
          ...(this.expectedEnvironment
            ? { expectedEnvironment: this.expectedEnvironment }
            : {}),
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    catalog: () => this.catalog!,
    error: () => this.error,
    fetchBytesMock: () => this.fetchBytes,
  };
}
