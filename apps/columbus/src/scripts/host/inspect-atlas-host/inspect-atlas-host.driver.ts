import { jest } from '@jest/globals';
import type {
  ArtifactVersion,
  AtlasHostData as HostData,
} from '../../../types/contracts';
import { aHostData, aHostArtifactVersion } from '../../../types/app.testkit';
import type { ArtifactRegistry } from '../artifact-registry/artifact-registry';
import type * as ArtifactRegistryModule from '../artifact-registry/artifact-registry';
import type * as HostCatalogModule from '../host-catalog/host-catalog';
import type * as PageRuntimeStateModule from '../page-runtime-state/page-runtime-state';
import { aRegistry } from '../registry.testkit';

const registryRootFor =
  jest.fn<typeof ArtifactRegistryModule.registryRootFor>();
const readRuntimeConfig = jest.fn<typeof HostCatalogModule.readRuntimeConfig>();
const readCatalog = jest.fn<typeof HostCatalogModule.readCatalog>();
const readStoredOverrides =
  jest.fn<typeof PageRuntimeStateModule.readStoredOverrides>();
const readRuntimeErrors =
  jest.fn<typeof PageRuntimeStateModule.readRuntimeErrors>();
const readVisibleAppIds =
  jest.fn<typeof PageRuntimeStateModule.readVisibleAppIds>();

jest.unstable_mockModule('../artifact-registry/artifact-registry', () => ({
  registryRootFor,
  uniqueManifests: (manifests: ArtifactVersion[]) => manifests,
}));
jest.unstable_mockModule('../host-catalog/host-catalog', () => ({
  readRuntimeConfig,
  readCatalog,
}));
jest.unstable_mockModule('../page-runtime-state/page-runtime-state', () => ({
  localOverridesOf: (hostId: string, manifests: ArtifactVersion[]) =>
    manifests.some(({ channel }) => channel === 'local')
      ? { schemaVersion: '1', hostId, overrides: [], generatedAt: '' }
      : undefined,
  readRuntimeErrors,
  readStoredOverrides,
  readVisibleAppIds,
}));

const { inspectAtlasHost } = await import('./inspect-atlas-host');

export class InspectAtlasHostDriver {
  private readonly config: HostData['config'] = {
    ...aHostData().config,
    hostId: 'shop',
  };
  private readonly host: ArtifactVersion = aHostArtifactVersion({
    id: 'shop',
    channel: 'production',
  });
  private catalog: HostData['catalog'] = {
    schemaVersion: '1',
    hostId: 'shop',
    revision: 'rev',
    host: this.host,
    apps: [],
  };
  private readonly registry: ArtifactRegistry = {
    readRegistry: jest.fn<ArtifactRegistry['readRegistry']>(),
    readVersions: jest.fn<ArtifactRegistry['readVersions']>(),
    loadManifest: jest.fn<ArtifactRegistry['loadManifest']>(),
    loadVersion: jest.fn<ArtifactRegistry['loadVersion']>(),
  };
  private result: HostData | undefined;
  private error: unknown;

  constructor() {
    jest.clearAllMocks();
    Object.defineProperty(globalThis, 'location', {
      value: { href: 'https://shop.example/dashboard' },
      configurable: true,
    });
    readRuntimeConfig.mockImplementation(async () => this.config);
    readCatalog.mockImplementation(async () => this.catalog);
    registryRootFor.mockReturnValue(undefined);
    readStoredOverrides.mockReturnValue({
      overrides: undefined,
      overrideScope: undefined,
    });
    readRuntimeErrors.mockReturnValue([]);
    readVisibleAppIds.mockReturnValue([]);
    jest.mocked(this.registry.readRegistry).mockResolvedValue(aRegistry());
    jest
      .mocked(this.registry.readVersions)
      .mockImplementation(async (deployed) => ({
        manifests: [deployed],
      }));
  }

  readonly given = {
    catalogApp: (manifest: ArtifactVersion): this => {
      this.catalog.apps.push(manifest);

      return this;
    },
    catalogHostId: (hostId: string): this => {
      this.catalog = { ...this.catalog, hostId };

      return this;
    },
    registryRoot: (root: string): this => {
      registryRootFor.mockReturnValue(root);

      return this;
    },
    registryFailure: (reason: string): this => {
      jest
        .mocked(this.registry.readRegistry)
        .mockRejectedValue(new Error(reason));

      return this;
    },
    versions: (manifests: ArtifactVersion[], error?: string): this => {
      jest.mocked(this.registry.readVersions).mockResolvedValue({
        manifests,
        ...(error ? { error } : {}),
      });

      return this;
    },
    versionsFailure: (reason: string): this => {
      jest
        .mocked(this.registry.readVersions)
        .mockRejectedValue(new Error(reason));

      return this;
    },
    storedOverrides: (stored: ReturnType<typeof readStoredOverrides>): this => {
      readStoredOverrides.mockReturnValue(stored);

      return this;
    },
    runtimeErrors: (errors: HostData['runtimeErrors']): this => {
      readRuntimeErrors.mockReturnValue(errors);

      return this;
    },
    visibleAppIds: (ids: string[]): this => {
      readVisibleAppIds.mockReturnValue(ids);

      return this;
    },
  };

  readonly when = {
    hostInspected: async (): Promise<void> => {
      try {
        this.result = await inspectAtlasHost(
          'atlas.runtime-overrides',
          this.registry,
        );
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    result: (): HostData | undefined => this.result,
    errorMessage: (): string | undefined =>
      this.error instanceof Error ? this.error.message : undefined,
    versionsRead: (): number =>
      jest.mocked(this.registry.readVersions).mock.calls.length,
    registryReadCount: (): number =>
      jest.mocked(this.registry.readRegistry).mock.calls.length,
  };
}
