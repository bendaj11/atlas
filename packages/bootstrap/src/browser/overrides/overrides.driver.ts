import type {
  AtlasHostCatalog,
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
  AtlasStaticRegistry,
} from '@atlas/schema';
import { jest } from '@jest/globals';
import {
  applyOverrides,
  type DevSession,
  type OverridesDependencies,
} from './overrides.js';

const STORAGE_KEY = 'atlas.runtime-overrides';

export class OverridesDriver {
  private runtime!: AtlasHostRuntimeConfig;
  private catalog!: AtlasHostCatalog;
  private suppliedSession: DevSession | undefined;
  private fetchedSession: DevSession | undefined;
  private registry: AtlasStaticRegistry | undefined;
  private registryFailure: Error | undefined;
  private readonly sessionStore = new Map<string, string>();
  private readonly localStore = new Map<string, string>();
  private readonly fetchJson = jest.fn<
    (options: { url: string }) => Promise<unknown>
  >(async ({ url }) => {
    if (url === this.runtime.developmentSessionUrl) return this.fetchedSession;
    if (this.registryFailure) throw this.registryFailure;

    return this.registry;
  });
  private readonly requestDevelopmentSession = jest.fn<
    OverridesDependencies['requestDevelopmentSession']
  >(async () => undefined);
  private readonly loadPublishedArtifact =
    jest.fn<OverridesDependencies['loadPublishedArtifact']>();
  private result: AtlasHostCatalog | undefined;
  private error: unknown;

  readonly given = {
    runtime: (runtime: AtlasHostRuntimeConfig): OverridesDriver => {
      this.runtime = runtime;

      return this;
    },
    catalog: (catalog: AtlasHostCatalog): OverridesDriver => {
      this.catalog = catalog;

      return this;
    },
    suppliedSession: (session: DevSession): OverridesDriver => {
      this.suppliedSession = session;

      return this;
    },
    fetchedSession: (session: DevSession): OverridesDriver => {
      this.fetchedSession = session;

      return this;
    },
    bridgeSession: (session: DevSession): OverridesDriver => {
      this.requestDevelopmentSession.mockResolvedValue(session);

      return this;
    },
    sessionStorageDocument: (document: unknown): OverridesDriver => {
      this.sessionStore.set(STORAGE_KEY, JSON.stringify(document));

      return this;
    },
    localStorageDocument: (document: unknown): OverridesDriver => {
      this.localStore.set(STORAGE_KEY, JSON.stringify(document));

      return this;
    },
    registry: (registry: AtlasStaticRegistry): OverridesDriver => {
      this.registry = registry;

      return this;
    },
    registryFailure: (error: Error): OverridesDriver => {
      this.registryFailure = error;

      return this;
    },
    publishedArtifactFailure: (error: Error): OverridesDriver => {
      this.loadPublishedArtifact.mockRejectedValue(error);

      return this;
    },
    publishedArtifact: (
      manifest: AtlasManifest | AtlasHostManifest,
    ): OverridesDriver => {
      this.loadPublishedArtifact.mockResolvedValue(manifest);

      return this;
    },
  };

  readonly when = {
    applied: async (): Promise<void> => {
      try {
        this.result = await applyOverrides({
          runtime: this.runtime,
          catalog: this.catalog,
          ...(this.suppliedSession === undefined
            ? {}
            : { developmentSession: this.suppliedSession }),
          dependencies: {
            sessionStorage: {
              getItem: (key) => this.sessionStore.get(key) ?? null,
              setItem: (key, value) => void this.sessionStore.set(key, value),
            },
            localStorage: {
              getItem: (key) => this.localStore.get(key) ?? null,
            },
            fetchJson: this.fetchJson as OverridesDependencies['fetchJson'],
            requestDevelopmentSession: this.requestDevelopmentSession,
            loadPublishedArtifact: this.loadPublishedArtifact,
          },
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    result: (): AtlasHostCatalog | undefined => this.result,
    error: (): unknown => this.error,
    storedSessionDocument: (): unknown =>
      JSON.parse(this.sessionStore.get(STORAGE_KEY) ?? 'null'),
    fetchJsonMock: () => this.fetchJson,
    requestDevelopmentSessionMock: () => this.requestDevelopmentSession,
    loadPublishedArtifactMock: () => this.loadPublishedArtifact,
  };
}
