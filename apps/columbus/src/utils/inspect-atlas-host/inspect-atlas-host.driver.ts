import { jest } from '@jest/globals';
import type { HostData } from '../../../types/host-data';
import type {
  ArtifactRegistry,
  ArtifactVersions,
  Registry,
} from '../artifact-registry/artifact-registry';
import type * as ArtifactRegistryModule from '../artifact-registry/artifact-registry';
import type * as HostCatalogModule from '../host-catalog/host-catalog';
import type * as PageRuntimeStateModule from '../page-runtime-state/page-runtime-state';

const artifactRegistry = await import('../artifact-registry/artifact-registry');
const hostCatalog = await import('../host-catalog/host-catalog');
const pageRuntimeState =
  await import('../page-runtime-state/page-runtime-state');
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
  ...artifactRegistry,
  registryRootFor,
}));
jest.unstable_mockModule('../host-catalog/host-catalog', () => ({
  ...hostCatalog,
  readRuntimeConfig,
  readCatalog,
}));
jest.unstable_mockModule('../page-runtime-state/page-runtime-state', () => ({
  ...pageRuntimeState,
  readRuntimeErrors,
  readStoredOverrides,
  readVisibleAppIds,
}));

export class InspectAtlasHostDriver {
  private readonly readRegistry = jest.fn<ArtifactRegistry['readRegistry']>();
  private readonly readVersions = jest.fn<ArtifactRegistry['readVersions']>();
  private readonly loadManifest = jest.fn<ArtifactRegistry['loadManifest']>();
  private readonly loadVersion = jest.fn<ArtifactRegistry['loadVersion']>();

  constructor() {
    jest.clearAllMocks();
  }

  readonly given = {
    pageLocation: (href: string) => {
      Object.defineProperty(globalThis, 'location', {
        value: { href },
        configurable: true,
      });

      return this;
    },
    runtimeConfig: (config: HostData['config']) => {
      readRuntimeConfig.mockResolvedValue(config);

      return this;
    },
    catalog: (catalog: HostData['catalog']) => {
      readCatalog.mockResolvedValue(catalog);

      return this;
    },
    registryRoot: (root: string | undefined) => {
      registryRootFor.mockReturnValue(root);

      return this;
    },
    registry: (registry: Registry) => {
      this.readRegistry.mockResolvedValue(registry);

      return this;
    },
    registryFailure: (error: Error) => {
      this.readRegistry.mockRejectedValue(error);

      return this;
    },
    versions: (versions: ArtifactVersions) => {
      this.readVersions.mockResolvedValueOnce(versions);

      return this;
    },
    versionsFailure: (error: Error) => {
      this.readVersions.mockRejectedValueOnce(error);

      return this;
    },
    storedOverrides: (stored: PageRuntimeStateModule.StoredOverrides) => {
      readStoredOverrides.mockReturnValue(stored);

      return this;
    },
    runtimeErrors: (errors: HostData['runtimeErrors']) => {
      readRuntimeErrors.mockReturnValue(errors);

      return this;
    },
    visibleAppIds: (ids: string[]) => {
      readVisibleAppIds.mockReturnValue(ids);

      return this;
    },
  };

  readonly get = {
    registry: () => ({
      readRegistry: this.readRegistry,
      readVersions: this.readVersions,
      loadManifest: this.loadManifest,
      loadVersion: this.loadVersion,
    }),
    readRegistry: () => this.readRegistry,
    readVersions: () => this.readVersions,
    readStoredOverrides: () => readStoredOverrides,
  };
}
