import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import { jest } from '@jest/globals';
import { aStaticRegistry } from '@atlas/testkit/internal';
import type { loadPublishedArtifact } from '../../published-artifact/index.js';
import type { RuntimeOverrides } from '../overrides.types.js';
import type { FetchStaticRegistry } from '../resolve-override-manifest/resolve-override-manifest.js';
import type { resolveOverrideManifest as resolveOverrideManifestType } from '../resolve-override-manifest/resolve-override-manifest.js';

const resolveOverrideManifest = jest.fn<typeof resolveOverrideManifestType>();
jest.unstable_mockModule(
  '../resolve-override-manifest/resolve-override-manifest.js',
  () => ({
    resolveOverrideManifest,
  }),
);
const { applyOverridesDocument } =
  await import('./apply-overrides-document.js');

export class ApplyOverridesDocumentDriver {
  private runtime!: AtlasHostRuntimeConfig;
  private catalog!: AtlasHostCatalog;
  private readonly fetchJson = jest.fn<FetchStaticRegistry>();
  private readonly loadPublishedArtifact =
    jest.fn<typeof loadPublishedArtifact>();
  private result: AtlasHostCatalog | undefined;
  private error: unknown;

  constructor() {
    resolveOverrideManifest.mockReset();
    resolveOverrideManifest.mockImplementation(
      async ({ manifest }) => manifest,
    );
  }

  readonly given = {
    runtime: (runtime: AtlasHostRuntimeConfig) => {
      this.runtime = runtime;

      return this;
    },
    catalog: (catalog: AtlasHostCatalog) => {
      this.catalog = catalog;

      return this;
    },
    unresolvableManifests: () => {
      resolveOverrideManifest.mockResolvedValue(undefined);

      return this;
    },
    manifestsResolvedThroughRegistry: (url: string) => {
      this.fetchJson.mockResolvedValue(aStaticRegistry());
      resolveOverrideManifest.mockImplementation(
        async ({ manifest, dependencies }) => {
          await dependencies.fetchJson({ url });

          return manifest;
        },
      );

      return this;
    },
    resolutionFailureFor: (appId: string, error: Error) => {
      resolveOverrideManifest.mockImplementation(async ({ manifest }) => {
        if (manifest.id === appId) throw error;

        return manifest;
      });

      return this;
    },
    pendingResolutions: () => {
      resolveOverrideManifest.mockReturnValue(new Promise(() => undefined));

      return this;
    },
  };

  readonly when = {
    applyRequested: async (overrides: RuntimeOverrides) => {
      void this.when.applied(overrides);
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
    applied: async (overrides: RuntimeOverrides) => {
      try {
        this.result = await applyOverridesDocument({
          runtime: this.runtime,
          catalog: this.catalog,
          overrides,
          dependencies: {
            fetchJson: this.fetchJson,
            loadPublishedArtifact: this.loadPublishedArtifact,
          },
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    result: () => this.result,
    error: () => this.error,
    resolveOverrideManifestMock: () => resolveOverrideManifest,
    fetchJsonMock: () => this.fetchJson,
  };
}
