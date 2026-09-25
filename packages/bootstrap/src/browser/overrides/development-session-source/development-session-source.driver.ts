import { jest } from '@jest/globals';
import type { requestDevelopmentSession } from '../../development-session/index.js';
import type { FetchOptions } from '../../fetch-json/index.js';
import type { DevSession } from '../overrides.types.js';

export class DevelopmentSessionSourceDriver {
  private readonly fetchJson =
    jest.fn<(options: FetchOptions) => Promise<DevSession>>();
  private readonly requestDevelopmentSession =
    jest.fn<typeof requestDevelopmentSession>();

  constructor() {
    sessionStorage.clear();
    localStorage.clear();
  }

  readonly given = {
    fetchedSession: (session: DevSession) => {
      this.fetchJson.mockResolvedValue(session);

      return this;
    },
    bridgeSession: (session: DevSession | undefined) => {
      this.requestDevelopmentSession.mockResolvedValue(session);

      return this;
    },
    sessionStorageItem: (key: string, value: string) => {
      sessionStorage.setItem(key, value);

      return this;
    },
    localStorageItem: (key: string, value: string) => {
      localStorage.setItem(key, value);

      return this;
    },
  };

  readonly get = {
    dependencies: () => ({
      sessionStorage,
      localStorage,
      fetchJson: this.fetchJson,
      requestDevelopmentSession: this.requestDevelopmentSession,
    }),
    fetchJsonMock: () => this.fetchJson,
    requestDevelopmentSessionMock: () => this.requestDevelopmentSession,
  };
}
