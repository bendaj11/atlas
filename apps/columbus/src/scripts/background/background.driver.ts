import { jest } from '@jest/globals';
import {
  type FakeChrome,
  installFakeChrome,
  type MessageSender,
} from '../../testkit/chrome.testkit';
import type { loadDevelopmentSession as loadDevelopmentSessionType } from '../development-session/development-session-background/development-session-background';
import type { clearHostDataCache as clearHostDataCacheType } from '../host/host-data-cache/host-data-cache';

const clearHostDataCache = jest.fn<typeof clearHostDataCacheType>();
const loadDevelopmentSession = jest.fn<typeof loadDevelopmentSessionType>();
const fetch = jest.fn<typeof globalThis.fetch>();

jest.unstable_mockModule('../host/host-data-cache/host-data-cache', () => ({
  clearHostDataCache,
}));
jest.unstable_mockModule(
  '../development-session/development-session-background/development-session-background',
  () => ({ loadDevelopmentSession }),
);

export class BackgroundDriver {
  private readonly chrome: FakeChrome = installFakeChrome();
  private sender: MessageSender = {};
  private started = false;
  private response: unknown;

  constructor() {
    jest.clearAllMocks();
    jest.resetModules();
    globalThis.fetch = fetch;
    clearHostDataCache.mockResolvedValue(undefined);
  }

  readonly given = {
    sender: (sender: MessageSender) => {
      this.sender = sender;

      return this;
    },
    developmentSession: (document: unknown) => {
      loadDevelopmentSession.mockResolvedValue(document);

      return this;
    },
    developmentSessionFailure: (error: Error) => {
      loadDevelopmentSession.mockRejectedValue(error);

      return this;
    },
    fetchResponse: (response: Response) => {
      fetch.mockResolvedValue(response);

      return this;
    },
  };

  readonly when = {
    tabUpdated: async (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
    ) => {
      await this.start();
      this.chrome.emitTabUpdated(tabId, changeInfo);
    },
    tabRemoved: async (tabId: number) => {
      await this.start();
      this.chrome.emitTabRemoved(tabId);
    },
    messageReceived: async (message: unknown) => {
      await this.start();
      this.response = await this.chrome.emitRuntimeMessage(
        message,
        this.sender,
      );
    },
  };

  readonly get = {
    response: () => this.response,
    clearHostDataCache: () => clearHostDataCache,
    loadDevelopmentSession: () => loadDevelopmentSession,
    fetch: () => fetch,
    actionIconPaths: () => this.chrome.actionIconPaths,
    badgeTexts: () => this.chrome.badgeTexts,
    badgeBackgroundColors: () => this.chrome.badgeBackgroundColors,
    badgeTextColors: () => this.chrome.badgeTextColors,
  };

  private async start() {
    if (this.started) return;
    this.started = true;
    await import('./background');
  }
}
