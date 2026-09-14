import { jest } from '@jest/globals';
import { type FakeChrome, installFakeChrome } from '../chrome.testkit';

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
    history.replaceState(null, '', '/');
    window.postMessage = postMessage;
  }

  readonly given = {
    addressBarSearch: (search: string): this => {
      history.replaceState(null, '', `/${search}`);

      return this;
    },
    runtimeResponse: (response: unknown): this => {
      this.chrome.onRuntimeMessage = async () => response;

      return this;
    },
    runtimeFailure: (reason: string): this => {
      this.chrome.onRuntimeMessage = async () => {
        throw new Error(reason);
      };

      return this;
    },
  };

  readonly when = {
    started: async (): Promise<this> => {
      await this.start();

      return this;
    },
    messagePosted: async (
      data: unknown,
      source: Window | null = window,
    ): Promise<this> => {
      await this.start();
      const event = new MessageEvent('message', { data });
      Object.defineProperty(event, 'source', { value: source });
      window.dispatchEvent(event);
      await new Promise((resolve) => setTimeout(resolve, 0));

      return this;
    },
  };

  readonly get = {
    bridgeMarkerName: (): string | undefined =>
      document.querySelector('meta')?.name,
    addressBarSearch: (): string => location.search,
    runtimeMessages: (): unknown[] => this.chrome.runtimeMessages,
    publishedMessages: (): unknown[] =>
      postMessage.mock.calls.map(([message]) => message),
    publishedTargetOrigins: (): unknown[] =>
      postMessage.mock.calls.map(([, targetOrigin]) => targetOrigin),
  };

  private async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await import('./development-session-content');
  }
}
