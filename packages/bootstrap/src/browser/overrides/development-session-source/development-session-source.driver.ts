import type { AtlasHostRuntimeConfig } from '@atlas/schema';
import { jest } from '@jest/globals';
import {
  discoverDevelopmentSession,
  isDevelopmentSessionSeeded,
  storeDevelopmentSession,
  readStoredOverridesDocument,
} from './development-session-source.js';
import type { requestDevelopmentSession } from '../../development-session/index.js';
import type { FetchOptions } from '../../fetch-json/index.js';
import type { DevSession } from '../overrides.types.js';

export class DevelopmentSessionSourceDriver {
  private readonly sessionStore = new Map<string, string>();
  private readonly localStore = new Map<string, string>();
  private readonly fetchJson =
    jest.fn<(options: FetchOptions) => Promise<DevSession>>();
  private readonly requestDevelopmentSession =
    jest.fn<typeof requestDevelopmentSession>();
  private readonly dependencies = {
    sessionStorage: {
      getItem: (key: string) => this.sessionStore.get(key) ?? null,
      setItem: (key: string, value: string) =>
        void this.sessionStore.set(key, value),
    },
    localStorage: {
      getItem: (key: string) => this.localStore.get(key) ?? null,
    },
    fetchJson: this.fetchJson,
    requestDevelopmentSession: this.requestDevelopmentSession,
  };
  private discovered: unknown;
  private stored: string | null | undefined;
  private seeded: boolean | undefined;

  readonly given = {
    fetchedSession: (session: DevSession) => {
      this.fetchJson.mockResolvedValue(session);

      return this;
    },
    bridgeSession: (session: unknown) => {
      this.requestDevelopmentSession.mockResolvedValue(session);

      return this;
    },
    sessionStorageValue: (value: string) => {
      this.sessionStore.set('atlas.runtime-overrides', value);

      return this;
    },
    storedSeed: (seed: string) => {
      this.sessionStore.set('atlas.development-session-seed', seed);

      return this;
    },
    localStorageValue: (value: string) => {
      this.localStore.set('atlas.runtime-overrides', value);

      return this;
    },
  };

  readonly when = {
    discovered: async (runtime: AtlasHostRuntimeConfig) => {
      this.discovered = await discoverDevelopmentSession({
        runtime,
        dependencies: this.dependencies,
      });
    },
    sessionStored: (session: DevSession) => {
      this.stored = storeDevelopmentSession({
        session,
        dependencies: this.dependencies,
      });
    },
    seedChecked: (session: DevSession) => {
      this.seeded = isDevelopmentSessionSeeded({
        session,
        dependencies: this.dependencies,
      });
    },
    documentRead: () => {
      this.stored = readStoredOverridesDocument(this.dependencies);
    },
  };

  readonly get = {
    discovered: () => this.discovered,
    stored: () => this.stored,
    seeded: () => this.seeded,
    sessionStorageValue: () => this.sessionStore.get('atlas.runtime-overrides'),
    storedSeed: () => this.sessionStore.get('atlas.development-session-seed'),
    fetchJsonMock: () => this.fetchJson,
    requestDevelopmentSessionMock: () => this.requestDevelopmentSession,
  };
}
