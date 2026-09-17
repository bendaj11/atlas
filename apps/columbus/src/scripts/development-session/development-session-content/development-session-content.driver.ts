import { jest } from '@jest/globals';
import {
  type FakeChrome,
  installFakeChrome,
} from '../../../testkit/chrome.testkit';

const windowListeners: Array<[string, EventListenerOrEventListenerObject]> = [];
const addWindowListener = window.addEventListener.bind(window);
window.addEventListener = (
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
) => {
  windowListeners.push([type, listener]);
  addWindowListener(type, listener, options);
};

const postMessage = jest.fn<typeof window.postMessage>();

export class DevelopmentSessionContentDriver {
  private readonly chrome: FakeChrome = installFakeChrome();
  private readonly runtimeMessage = jest.fn<FakeChrome['onRuntimeMessage']>();
  private started = false;

  constructor() {
    jest.clearAllMocks();
    jest.resetModules();
    windowListeners
      .splice(0)
      .forEach(([type, listener]) =>
        window.removeEventListener(type, listener),
      );
    document.head.innerHTML = '';
    sessionStorage.clear();
    history.replaceState(null, '', '/');
    window.postMessage = postMessage;
    this.chrome.onRuntimeMessage = this.runtimeMessage;
    this.runtimeMessage.mockResolvedValue(undefined);
  }

  readonly given = {
    addressBarSearch: (search: string) => {
      history.replaceState(null, '', `/${search}`);

      return this;
    },
    sessionStorageItem: (key: string, value: string) => {
      sessionStorage.setItem(key, value);

      return this;
    },
    runtimeResponse: (response: unknown) => {
      this.runtimeMessage.mockResolvedValue(response);

      return this;
    },
    runtimeFailure: (error: Error) => {
      this.runtimeMessage.mockRejectedValue(error);

      return this;
    },
  };

  readonly when = {
    started: () => this.start(),
    messagePosted: async (data: unknown, source: Window | null = window) => {
      await this.start();
      const event = new MessageEvent('message', { data });
      Object.defineProperty(event, 'source', { value: source });
      window.dispatchEvent(event);
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  };

  readonly get = {
    bridgeMarkerName: () => document.querySelector('meta')?.name,
    addressBarSearch: () => location.search,
    pageUrl: () => location.href,
    sessionStorageItem: (key: string) => sessionStorage.getItem(key),
    runtimeMessage: () => this.runtimeMessage,
    postMessage: () => postMessage,
  };

  private async start() {
    if (this.started) return;
    this.started = true;
    await import('./development-session-content');
  }
}
