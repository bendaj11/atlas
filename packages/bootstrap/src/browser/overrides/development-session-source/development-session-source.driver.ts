import type { AtlasHostRuntimeConfig } from '@atlas/schema';
import { jest } from '@jest/globals';
import {
  discoverDevelopmentSession,
  storeDevelopmentSession,
  storedOverridesDocument,
} from './development-session-source.js';
import type { DevSession, OverridesDependencies } from '../overrides.types.js';

export class DevelopmentSessionSourceDriver {
  private readonly sessionStore = new Map<string, string>();
  private readonly localStore = new Map<string, string>();
  private readonly fetchJson =
    jest.fn<(options: unknown) => Promise<unknown>>();
  private readonly requestDevelopmentSession =
    jest.fn<OverridesDependencies['requestDevelopmentSession']>();
  private readonly dependencies = {
    sessionStorage: {
      getItem: (key: string) => this.sessionStore.get(key) ?? null,
      setItem: (key: string, value: string) =>
        void this.sessionStore.set(key, value),
    },
    localStorage: {
      getItem: (key: string) => this.localStore.get(key) ?? null,
    },
    fetchJson: this.fetchJson as OverridesDependencies['fetchJson'],
    requestDevelopmentSession: this.requestDevelopmentSession,
    loadPublishedArtifact:
      jest.fn<OverridesDependencies['loadPublishedArtifact']>(),
  };
  private discovered: unknown;
  private stored: string | null | undefined;

  readonly given = {
    fetchedSession: (session: unknown): DevelopmentSessionSourceDriver => {
      this.fetchJson.mockResolvedValue(session);

      return this;
    },
    bridgeSession: (session: unknown): DevelopmentSessionSourceDriver => {
      this.requestDevelopmentSession.mockResolvedValue(session);

      return this;
    },
    sessionStorageValue: (value: string): DevelopmentSessionSourceDriver => {
      this.sessionStore.set('atlas.runtime-overrides', value);

      return this;
    },
    localStorageValue: (value: string): DevelopmentSessionSourceDriver => {
      this.localStore.set('atlas.runtime-overrides', value);

      return this;
    },
  };

  readonly when = {
    discovered: async (runtime: AtlasHostRuntimeConfig): Promise<void> => {
      this.discovered = await discoverDevelopmentSession({
        runtime,
        dependencies: this.dependencies,
      });
    },
    sessionStored: (session: DevSession): void => {
      this.stored = storeDevelopmentSession({
        session,
        dependencies: this.dependencies,
      });
    },
    documentRead: (): void => {
      this.stored = storedOverridesDocument(this.dependencies);
    },
  };

  readonly get = {
    discovered: (): unknown => this.discovered,
    stored: (): string | null | undefined => this.stored,
    sessionStorageValue: (): string | undefined =>
      this.sessionStore.get('atlas.runtime-overrides'),
    fetchJsonMock: () => this.fetchJson,
    requestDevelopmentSessionMock: () => this.requestDevelopmentSession,
  };
}
