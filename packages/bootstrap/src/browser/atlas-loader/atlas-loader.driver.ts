import type {
  AtlasHostCatalog,
  AtlasHostDeploymentManifest,
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
  AtlasManifestDescriptor,
} from '@atlas/schema';
import { jest } from '@jest/globals';
import type { HostModule, HostMountRequest } from '../host-module.js';
import {
  startAtlasLoader,
  type AtlasLoaderDependencies,
} from './atlas-loader.js';

interface SnapshotElement {
  id: string;
  type: string;
  textContent: string;
}

export class AtlasLoaderDriver {
  private runtimeConfig!: AtlasHostRuntimeConfig;
  private deployment: AtlasHostDeploymentManifest | undefined;
  private developmentSession: unknown;
  private readonly artifacts = new Map<
    string,
    AtlasManifest | AtlasHostManifest
  >();
  private hostRootPresent = true;
  private existingSnapshot: SnapshotElement | undefined;
  private createdSnapshot: SnapshotElement | undefined;
  private activeArtifactLoads = 0;
  private maximumArtifactLoads = 0;
  private readonly root = { replaceChildren: jest.fn() };
  private readonly mount = jest.fn<
    (request: HostMountRequest) => Promise<void>
  >(async () => undefined);
  private hostModule: HostModule = { mount: this.mount };
  private readonly installModuleShim = jest.fn<
    AtlasLoaderDependencies['installModuleShim']
  >(async () => undefined);
  private readonly fetchBytes = jest.fn<AtlasLoaderDependencies['fetchBytes']>(
    async () => new TextEncoder().encode(JSON.stringify(this.deployment)),
  );
  private readonly fetchJson = jest.fn<
    (options: { url: string }) => Promise<unknown>
  >(async ({ url }) =>
    url === '/atlas.runtime.json'
      ? this.runtimeConfig
      : this.developmentSession,
  );
  private readonly loadPublishedArtifact = jest.fn<
    AtlasLoaderDependencies['loadPublishedArtifact']
  >(async ({ reference }) => {
    this.activeArtifactLoads += 1;
    this.maximumArtifactLoads = Math.max(
      this.maximumArtifactLoads,
      this.activeArtifactLoads,
    );
    await Promise.resolve();
    this.activeArtifactLoads -= 1;

    return this.artifacts.get(reference.path)!;
  });
  private readonly applyOverrides = jest.fn<
    AtlasLoaderDependencies['applyOverrides']
  >(async ({ catalog }) => catalog);
  private readonly validateCatalog =
    jest.fn<AtlasLoaderDependencies['validateCatalog']>();
  private readonly loadHostModule = jest.fn<
    AtlasLoaderDependencies['loadHostModule']
  >(async () => this.hostModule);
  private error: unknown;

  readonly given = {
    runtimeConfig: (
      runtimeConfig: AtlasHostRuntimeConfig,
    ): AtlasLoaderDriver => {
      this.runtimeConfig = runtimeConfig;

      return this;
    },
    deployment: (
      deployment: AtlasHostDeploymentManifest,
    ): AtlasLoaderDriver => {
      this.deployment = deployment;

      return this;
    },
    publishedArtifact: (
      reference: AtlasManifestDescriptor,
      manifest: AtlasManifest | AtlasHostManifest,
    ): AtlasLoaderDriver => {
      this.artifacts.set(reference.path, manifest);

      return this;
    },
    developmentSession: (session: unknown): AtlasLoaderDriver => {
      this.developmentSession = session;

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
    existingSnapshotElement: (element: SnapshotElement): AtlasLoaderDriver => {
      this.existingSnapshot = element;

      return this;
    },
  };

  readonly when = {
    started: async (): Promise<void> => {
      try {
        await startAtlasLoader({
          document: {
            createElement: (() => {
              this.createdSnapshot = { id: '', type: '', textContent: '' };

              return this.createdSnapshot;
            }) as unknown as Document['createElement'],
            getElementById: (id: string) => {
              if (id === 'atlas-host-root')
                return this.hostRootPresent
                  ? (this.root as unknown as HTMLElement)
                  : null;

              return (this.existingSnapshot as unknown as HTMLElement) ?? null;
            },
            head: { append: jest.fn() } as unknown as HTMLHeadElement,
          },
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
    mountedCatalog: (): AtlasHostCatalog | undefined =>
      this.mount.mock.calls[0]?.[0].catalog,
    mountRequest: (): HostMountRequest | undefined =>
      this.mount.mock.calls[0]?.[0],
    createdSnapshot: (): unknown =>
      this.createdSnapshot && {
        ...this.createdSnapshot,
        textContent: JSON.parse(this.createdSnapshot.textContent),
      },
    maximumArtifactLoads: (): number => this.maximumArtifactLoads,
    rootReplaceChildrenMock: () => this.root.replaceChildren,
    installModuleShimMock: () => this.installModuleShim,
    fetchBytesMock: () => this.fetchBytes,
    fetchJsonMock: () => this.fetchJson,
    loadPublishedArtifactMock: () => this.loadPublishedArtifact,
    applyOverridesMock: () => this.applyOverrides,
    validateCatalogMock: () => this.validateCatalog,
    loadHostModuleMock: () => this.loadHostModule,
    mountMock: () => this.mount,
  };
}
