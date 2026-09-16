import { jest } from '@jest/globals';
import type { ArtifactVersion } from '../../../types/artifact-version';
import type { HostData } from '../../../types/host-data';
import { aHostData } from '../../../types/host-data.testkit';
import {
  aHostArtifactVersion,
  anAppArtifactVersion,
} from '../../../types/artifact-version.testkit';
import {
  aPublishedArtifact,
  type PublishedArtifact,
} from '../registry.testkit';
import type { fetchWithTimeout as fetchWithTimeoutType } from '../manifest-fetch/manifest-fetch';

const fetchWithTimeout = jest.fn<typeof fetchWithTimeoutType>();

jest.unstable_mockModule('../manifest-fetch/manifest-fetch', () => ({
  fetchWithTimeout,
  manifestReference: (root: string, descriptor: { path: string }) => ({
    ...descriptor,
    url: `${root}/${descriptor.path}`,
  }),
}));

const { readCatalog, readRuntimeConfig } = await import('./host-catalog');

type RuntimeConfig = HostData['config'];
type Catalog = HostData['catalog'];

export class HostCatalogDriver {
  private config: RuntimeConfig = {
    ...aHostData().config,
    hostId: 'shop',
    environment: 'production',
    artifactRegistryUrl: 'https://registry.example',
  };
  private readonly responses = new Map<string, () => Response>();
  private readonly published = new Map<string, PublishedArtifact>();
  private readonly host = aPublishedArtifact(
    aHostArtifactVersion({ id: 'shop' }),
  );
  private readonly app = aPublishedArtifact(
    anAppArtifactVersion({ id: 'orders', version: '1.0.0' }),
  );
  private catalog: Catalog | undefined;
  private runtimeConfig: RuntimeConfig | undefined;
  private error: unknown;

  constructor() {
    jest.clearAllMocks();
    document.body.innerHTML = '';
    Object.defineProperty(globalThis, 'location', {
      value: { href: 'https://shop.example/' },
      configurable: true,
    });
    fetchWithTimeout.mockImplementation(async (input) => {
      const url = String(input);
      const respond = this.responses.get(url);

      return respond ? respond() : aResponse(null, 404);
    });
    [this.host, this.app].forEach((artifact) =>
      this.published.set(artifact.path, artifact),
    );
  }

  readonly given = {
    config: (config: Partial<RuntimeConfig>): this => {
      this.config = { ...this.config, ...config };

      return this;
    },
    response: (url: string, body: unknown, status = 200): this => {
      this.responses.set(url, () => aResponse(body, status));

      return this;
    },
    responseStatus: (url: string, status: number): this => {
      this.responses.set(url, () => aResponse(null, status));

      return this;
    },
    deployment: (overrides: Record<string, unknown> = {}): this => {
      this.responses.set(
        'https://registry.example/environments/production/hosts/shop/manifest.json',
        () =>
          aResponse(
            {
              schemaVersion: 'v1',
              kind: 'host-deployment',
              hostId: 'shop',
              environment: 'production',
              deploymentRevision: 'rev-1',
              host: this.host.descriptor,
              apps: [this.app.descriptor],
              ...overrides,
            },
            200,
          ),
      );

      return this;
    },
    runtimeSnapshot: (snapshot: unknown): this => {
      const script = document.createElement('script');
      script.id = 'atlas-runtime-snapshot';
      script.type = 'application/json';
      script.textContent = JSON.stringify(snapshot);
      document.body.append(script);

      return this;
    },
  };

  readonly when = {
    runtimeConfigRead: async (): Promise<void> => {
      try {
        this.runtimeConfig = await readRuntimeConfig();
      } catch (error) {
        this.error = error;
      }
    },
    catalogRead: async (): Promise<void> => {
      try {
        this.catalog = await readCatalog(this.config, async (reference) => {
          const artifact = this.published.get(reference.path);
          if (!artifact) throw new Error(`${reference.url} returned 404.`);

          return artifact.manifest;
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    runtimeConfig: (): RuntimeConfig | undefined => this.runtimeConfig,
    catalog: (): Catalog | undefined => this.catalog,
    catalogAppVersions: (): string[] =>
      this.catalog?.apps.map(({ version }) => version) ?? [],
    errorMessage: (): string | undefined =>
      this.error instanceof Error ? this.error.message : undefined,
    fetchedUrls: (): string[] =>
      fetchWithTimeout.mock.calls.map(([input]) => String(input)),
    hostManifest: (): ArtifactVersion => this.host.manifest,
    appManifest: (): ArtifactVersion => this.app.manifest,
  };
}

function aResponse(body: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}
