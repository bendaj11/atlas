import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import { jest } from '@jest/globals';
import type { HostModule, HostMountRequest } from '../host-module.js';
import type { fetchBytes, fetchJson } from '../fetch-json/index.js';
import type { loadHostModule } from '../host-loader/index.js';
import type { installModuleShim } from '../module-shim/index.js';
import type { applyOverrides } from '../overrides/index.js';
import type { loadPublishedArtifact } from '../published-artifact/index.js';
import type { validateCatalog } from '../validation/index.js';
import { HOST_ROOT_ELEMENT_ID } from './atlas-loader.constants.js';
import type { LoaderDocument } from './atlas-loader.types.js';
import type { publishRuntimeSnapshot as publishRuntimeSnapshotType } from './runtime-snapshot/runtime-snapshot.js';
import type { loadStartupCatalog as loadStartupCatalogType } from './startup-catalog/startup-catalog.js';

const loadStartupCatalog = jest.fn<typeof loadStartupCatalogType>();
const publishRuntimeSnapshot = jest.fn<typeof publishRuntimeSnapshotType>();
jest.unstable_mockModule('./startup-catalog/startup-catalog.js', () => ({
  loadStartupCatalog,
}));
jest.unstable_mockModule('./runtime-snapshot/runtime-snapshot.js', () => ({
  publishRuntimeSnapshot,
}));
const { startAtlasLoader } = await import('./atlas-loader.js');

export class AtlasLoaderDriver {
  private runtimeConfig!: AtlasHostRuntimeConfig;
  private hostRootPresent = true;
  private readonly root = { replaceChildren: jest.fn() };
  private readonly document: LoaderDocument = {
    createElement: jest.fn() as unknown as Document['createElement'],
    getElementById: (id: string) =>
      id === HOST_ROOT_ELEMENT_ID && this.hostRootPresent
        ? (this.root as unknown as HTMLElement)
        : null,
    head: {} as HTMLHeadElement,
  };
  private readonly mount = jest.fn<
    (request: HostMountRequest) => Promise<void>
  >(async () => undefined);
  private hostModule: HostModule = { mount: this.mount };
  private readonly installModuleShim = jest.fn<typeof installModuleShim>(
    async () => undefined,
  );
  private readonly fetchBytes = jest.fn<typeof fetchBytes>();
  private readonly fetchJson = jest.fn<
    (options: { url: string }) => Promise<unknown>
  >(async () => this.runtimeConfig);
  private readonly loadPublishedArtifact =
    jest.fn<typeof loadPublishedArtifact>();
  private readonly applyOverrides = jest.fn<typeof applyOverrides>(
    async ({ catalog }) => catalog,
  );
  private readonly validateCatalog = jest.fn<typeof validateCatalog>();
  private readonly loadHostModule = jest.fn<typeof loadHostModule>(
    async () => this.hostModule,
  );
  private error: unknown;

  constructor() {
    loadStartupCatalog.mockReset();
    publishRuntimeSnapshot.mockReset();
  }

  readonly given = {
    runtimeConfig: (runtimeConfig: AtlasHostRuntimeConfig) => {
      this.runtimeConfig = runtimeConfig;

      return this;
    },
    startupCatalog: (
      startup: Awaited<ReturnType<typeof loadStartupCatalogType>>,
    ) => {
      loadStartupCatalog.mockResolvedValue(startup);

      return this;
    },
    overriddenCatalog: (catalog: AtlasHostCatalog) => {
      this.applyOverrides.mockResolvedValue(catalog);

      return this;
    },
    hostModule: (module: HostModule) => {
      this.hostModule = module;

      return this;
    },
    hostRootPresent: (present: boolean) => {
      this.hostRootPresent = present;

      return this;
    },
  };

  readonly when = {
    started: async () => {
      try {
        await startAtlasLoader({
          document: this.document,
          location: { href: 'https://host.example/' },
          fetchBytes: this.fetchBytes,
          fetchJson: this.fetchJson as typeof fetchJson,
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
    error: () => this.error,
    mountRequest: () => this.mount.mock.calls[0]?.[0],
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
