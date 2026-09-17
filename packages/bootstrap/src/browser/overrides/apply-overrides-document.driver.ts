import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import { jest } from '@jest/globals';
import type {
  OverridesDependencies,
  RuntimeOverrides,
} from './overrides.types.js';
import type { resolveOverrideManifest as resolveOverrideManifestType } from './resolve-override-manifest.js';

const resolveOverrideManifest = jest.fn<typeof resolveOverrideManifestType>();
jest.unstable_mockModule('./resolve-override-manifest.js', () => ({
  resolveOverrideManifest,
}));
const { applyOverridesDocument } =
  await import('./apply-overrides-document.js');

export class ApplyOverridesDocumentDriver {
  private runtime!: AtlasHostRuntimeConfig;
  private catalog!: AtlasHostCatalog;
  private result: AtlasHostCatalog | undefined;
  private error: unknown;

  constructor() {
    resolveOverrideManifest.mockReset();
    resolveOverrideManifest.mockImplementation(
      async ({ manifest }) => manifest,
    );
  }

  readonly given = {
    runtime: (
      runtime: AtlasHostRuntimeConfig,
    ): ApplyOverridesDocumentDriver => {
      this.runtime = runtime;

      return this;
    },
    catalog: (catalog: AtlasHostCatalog): ApplyOverridesDocumentDriver => {
      this.catalog = catalog;

      return this;
    },
    unresolvableManifests: (): ApplyOverridesDocumentDriver => {
      resolveOverrideManifest.mockResolvedValue(undefined);

      return this;
    },
  };

  readonly when = {
    applied: async (overrides: RuntimeOverrides): Promise<void> => {
      try {
        this.result = await applyOverridesDocument({
          runtime: this.runtime,
          catalog: this.catalog,
          overrides,
          dependencies: {} as OverridesDependencies,
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    result: (): AtlasHostCatalog | undefined => this.result,
    error: (): unknown => this.error,
    resolveOverrideManifestMock: () => resolveOverrideManifest,
  };
}
