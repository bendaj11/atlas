import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import { jest } from '@jest/globals';
import type { HostModule, HostMountRequest } from '../host-module.js';
import type { AtlasLoaderDependencies } from './atlas-loader.types.js';
import type { publishRuntimeSnapshot as publishRuntimeSnapshotType } from './runtime-snapshot.js';
import type { loadStartupCatalog as loadStartupCatalogType } from './startup-catalog.js';

const loadStartupCatalog = jest.fn<typeof loadStartupCatalogType>();
const publishRuntimeSnapshot = jest.fn<typeof publishRuntimeSnapshotType>();
jest.unstable_mockModule('./startup-catalog.js', () => ({
  loadStartupCatalog,
}));
jest.unstable_mockModule('./runtime-snapshot.js', () => ({
  publishRuntimeSnapshot,
}));
const { startAtlasLoader } = await import('./atlas-loader.js');

export class AtlasLoaderDriver {
  private runtimeConfig!: AtlasHostRuntimeConfig;
  private hostRootPresent = true;
  private readonly root = { replaceChildren: jest.fn() };
  private readonly document: AtlasLoaderDependencies['document'] = {
    createElement: jest.fn() as unknown as Document['createElement'],
    getElementById: (id: string) =>
      id === 'atlas-host-root' && this.hostRootPresent
        ? (this.root as unknown as HTMLElement)
        : null,
    head: {} as HTMLHeadElement,
  };
  private readonly mount = jest.fn<
    (request: HostMountRequest) => Promise<void>
  >(async () => undefined);
  private hostModule: HostModule = { mount: this.mount };
  private readonly installModuleShim = jest.fn<
    AtlasLoaderDependencies['installModuleShim']
  >(async () => undefined);
  private readonly fetchBytes =
    jest.fn<AtlasLoaderDependencies['fetchBytes']>();
  private readonly fetchJson = jest.fn<
    (options: { url: string }) => Promise<unknown>
  >(async () => this.runtimeConfig);
  private readonly loadPublishedArtifact =
    jest.fn<AtlasLoaderDependencies['loadPublishedArtifact']>();
  private readonly applyOverrides = jest.fn<
    AtlasLoaderDependencies['applyOverrides']
  >(async ({ catalog }) => catalog);
  private readonly validateCatalog =
    jest.fn<AtlasLoaderDependencies['validateCatalog']>();
  private readonly loadHostModule = jest.fn<
    AtlasLoaderDependencies['loadHostModule']
  >(async () => this.hostModule);
  private error: unknown;

  constructor() {
    loadStartupCatalog.mockReset();
    publishRuntimeSnapshot.mockReset();
  }

  readonly given = {
    runtimeConfig: (
      runtimeConfig: AtlasHostRuntimeConfig,
    ): AtlasLoaderDriver => {
      this.runtimeConfig = runtimeConfig;

      return this;
    },
    startupCatalog: (
      startup: Awaited<ReturnType<typeof loadStartupCatalogType>>,
    ): AtlasLoaderDriver => {
      loadStartupCatalog.mockResolvedValue(startup);

      return this;
    },
    overriddenCatalog: (catalog: AtlasHostCatalog): AtlasLoaderDriver => {
      this.applyOverrides.mockResolvedValue(catalog);

      return this;
    },
    hostModule: (module: HostModule): AtlasLoaderDriver => {
      this.hostModule = module;

      return this;
    },
    hostRootPresent: (present: boolean): AtlasLoaderDriver => {
      this.hostRootPresent = present;

      return this;
    },
  };

  readonly when = {
    started: async (): Promise<void> => {
      try {
        await startAtlasLoader({
          document: this.document,
          location: { href: 'https://host.example/' },
          fetchBytes: this.fetchBytes,
          fetchJson: this.fetchJson as AtlasLoaderDependencies['fetchJson'],
          installModuleShim: this.installModuleShim,
          loadHostModule: this.loadHostModule,
          loadPublishedArtifact: this.loadPublishedArtifact,
          applyOverrides: this.applyOverrides,
          validateCatalog: this.validateCatalog,
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    error: (): unknown => this.error,
    mountRequest: (): HostMountRequest | undefined =>
      this.mount.mock.calls[0]?.[0],
    rootReplaceChildrenMock: () => this.root.replaceChildren,
    installModuleShimMock: () => this.installModuleShim,
    fetchJsonMock: () => this.fetchJson,
    loadStartupCatalogMock: () => loadStartupCatalog,
    applyOverridesMock: () => this.applyOverrides,
    validateCatalogMock: () => this.validateCatalog,
    publishRuntimeSnapshotMock: () => publishRuntimeSnapshot,
    loadHostModuleMock: () => this.loadHostModule,
    mountMock: () => this.mount,
  };
}
