import { jest } from '@jest/globals';
import type {
  AtlasExtensionManifest as Manifest,
  AtlasHostData as HostData,
} from '../../../types/contracts';
import { aHostData } from '../../../types/app.testkit';
import {
  aRegistry,
  aRegistryArtifact,
  type PublishedArtifact,
} from '../registry.testkit';
import type { fetchWithTimeout as fetchWithTimeoutType } from '../manifest-fetch/manifest-fetch';
import type * as ManifestFetchModule from '../manifest-fetch/manifest-fetch';

const fetchWithTimeout = jest.fn<typeof fetchWithTimeoutType>();
const fetchVerifiedManifest =
  jest.fn<typeof ManifestFetchModule.fetchVerifiedManifest>();

jest.unstable_mockModule('../manifest-fetch/manifest-fetch', () => ({
  fetchWithTimeout,
  fetchVerifiedManifest,
  manifestReference: (root: string, descriptor: { path: string }) => ({
    ...descriptor,
    url: `${root}/${descriptor.path}`,
  }),
}));

const { createArtifactRegistry, registryRootFor, uniqueManifests } =
  await import('./artifact-registry');

const ROOT = 'https://registry.example';

export class ArtifactRegistryDriver {
  private readonly registry = createArtifactRegistry();
  private readonly published = new Map<string, PublishedArtifact>();
  private registryDocument = aRegistry();
  private versions:
    Awaited<ReturnType<typeof this.registry.readVersions>> | undefined;
  private loaded: Manifest | undefined;
  private root: string | undefined;
  private unique: Manifest[] = [];
  private error: unknown;

  constructor() {
    jest.clearAllMocks();
    fetchWithTimeout.mockImplementation(async () =>
      Response.json(this.registryDocument),
    );
    fetchVerifiedManifest.mockImplementation(async (reference) => {
      const artifact = this.published.get(reference.path);
      if (!artifact) throw new Error(`${reference.url} returned 404.`);

      return artifact.manifest;
    });
  }

  readonly given = {
    registryResponse: (body: unknown): this => {
      fetchWithTimeout.mockResolvedValue(Response.json(body));

      return this;
    },
    registryStatus: (status: number): this => {
      fetchWithTimeout.mockResolvedValue(new Response(null, { status }));

      return this;
    },
    registeredApp: (
      deployed: Manifest,
      published: PublishedArtifact[],
    ): this => {
      published.forEach((artifact) =>
        this.published.set(artifact.path, artifact),
      );
      this.registryDocument.apps[deployed.id] = aRegistryArtifact(
        deployed,
        published,
      );

      return this;
    },
    fetchedManifestAt: (path: string, manifest: Manifest): this => {
      const artifact = this.published.get(path);
      if (artifact) this.published.set(path, { ...artifact, manifest });

      return this;
    },
    unpublishedPreview: (
      deployed: Manifest,
      published: PublishedArtifact,
    ): this => {
      this.registryDocument.apps[deployed.id] = aRegistryArtifact(deployed, [
        published,
      ]);

      return this;
    },
  };

  readonly when = {
    registryRead: async (): Promise<this> => {
      try {
        this.registryDocument = await this.registry.readRegistry(ROOT);
      } catch (error) {
        this.error = error;
      }

      return this;
    },
    versionsRead: async (deployed: Manifest): Promise<this> => {
      try {
        this.versions = await this.registry.readVersions(
          deployed,
          this.registryDocument,
          ROOT,
        );
      } catch (error) {
        this.error = error;
      }

      return this;
    },
    versionLoaded: async (
      artifactKey: string,
      versionKey: string,
    ): Promise<this> => {
      try {
        this.loaded = await this.registry.loadVersion(artifactKey, versionKey);
      } catch (error) {
        this.error = error;
      }

      return this;
    },
    rootResolved: (config: Partial<HostData['config']>): this => {
      this.root = registryRootFor({ ...aHostData().config, ...config });

      return this;
    },
    deduplicated: (manifests: Manifest[]): this => {
      this.unique = uniqueManifests(manifests);

      return this;
    },
  };

  readonly get = {
    errorMessage: (): string | undefined =>
      this.error instanceof Error ? this.error.message : undefined,
    versionKeys: (): string[] =>
      this.versions?.manifests.map(({ channel, version, buildId, prNumber }) =>
        channel === 'pr'
          ? `pr:${prNumber}:${buildId}`
          : `${channel}:${version}:${buildId}`,
      ) ?? [],
    versionsError: (): string | undefined => this.versions?.error,
    loadedVersion: (): string | undefined => this.loaded?.version,
    manifestFetchCount: (): number => fetchVerifiedManifest.mock.calls.length,
    root: (): string | undefined => this.root,
    uniqueVersions: (): string[] => this.unique.map(({ version }) => version),
  };
}
