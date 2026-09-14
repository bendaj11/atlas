import { jest } from '@jest/globals';
import {
  type FakeChrome,
  installFakeChrome,
  type MessageSender,
} from '../chrome.testkit';
import type { loadDevelopmentSession as loadDevelopmentSessionType } from '../development-session/development-session-background';
import type { clearHostDataCache as clearHostDataCacheType } from '../host/host-data-cache';
import { loadDevelopmentSessionRequest } from '../shared/messages/messages';

const clearHostDataCache = jest.fn<typeof clearHostDataCacheType>();
const loadDevelopmentSession = jest.fn<typeof loadDevelopmentSessionType>();
const fetch = jest.fn<typeof globalThis.fetch>();

jest.unstable_mockModule('../host/host-data-cache', () => ({
  clearHostDataCache,
}));
jest.unstable_mockModule(
  '../development-session/development-session-background',
  () => ({ loadDevelopmentSession }),
);

const PREVIEW_URL = 'http://localhost:4300/dashboard';

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
    loadDevelopmentSession.mockResolvedValue(undefined);
    fetch.mockResolvedValue(aJsonResponse(undefined, 200));
  }

  readonly given = {
    sender: (sender: MessageSender): this => {
      this.sender = sender;

      return this;
    },
    developmentSession: (document: unknown): this => {
      loadDevelopmentSession.mockResolvedValue(document);

      return this;
    },
    developmentSessionFailure: (reason: string): this => {
      loadDevelopmentSession.mockRejectedValue(new Error(reason));

      return this;
    },
    fetchResponse: (body: unknown, status: number): this => {
      fetch.mockResolvedValue(aJsonResponse(body, status));

      return this;
    },
  };

  readonly when = {
    tabUpdated: async (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
    ): Promise<this> => {
      await this.start();
      this.chrome.emitTabUpdated(tabId, changeInfo);

      return this;
    },
    tabRemoved: async (tabId: number): Promise<this> => {
      await this.start();
      this.chrome.emitTabRemoved(tabId);

      return this;
    },
    messageReceived: async (message: unknown): Promise<this> => {
      await this.start();
      this.response = await this.chrome.emitRuntimeMessage(
        message,
        this.sender,
      );

      return this;
    },
    developmentSessionFetched: async (url: string): Promise<this> => {
      loadDevelopmentSession.mockImplementation((_request, dependencies) =>
        dependencies.fetchJson(url),
      );
      this.sender = { tab: { id: 1, url: PREVIEW_URL } };

      return this.when.messageReceived(
        loadDevelopmentSessionRequest({
          hostId: 'shop',
          previewUrl: PREVIEW_URL,
        }),
      );
    },
  };

  readonly get = {
    response: (): unknown => this.response,
    clearedCacheTabIds: (): Array<number | undefined> =>
      clearHostDataCache.mock.calls.map(([tabId]) => tabId),
    loadedRequests: () =>
      loadDevelopmentSession.mock.calls.map(([request]) => request),
    actionIconPaths: () => this.chrome.actionIconPaths,
    badgeTexts: () => this.chrome.badgeTexts,
    badgeBackgroundColors: (): string[] => this.chrome.badgeBackgroundColors,
    badgeTextColors: (): string[] => this.chrome.badgeTextColors,
    fetchedUrls: (): string[] =>
      fetch.mock.calls.map(([input]) => String(input)),
    fetchCacheMode: (): RequestCache | undefined =>
      fetch.mock.calls[0]?.[1]?.cache,
  };

  private async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await import('./background');
  }
}

function aJsonResponse(body: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new Error('No body.');

      return body;
    },
  } as Response;
}
