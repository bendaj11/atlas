import { jest } from '@jest/globals';
import type {
  AtlasExtensionManifest as Manifest,
  AtlasHostData as HostData,
} from '../../types/contracts';
import { aHostData, aManifest } from '../../types/app.testkit';
import { type FakeChrome, installFakeChrome } from '../chrome.testkit';
import type { ArtifactRegistry } from '../host/artifact-registry/artifact-registry';
import type { inspectAtlasHost as inspectAtlasHostType } from '../host/inspect-atlas-host/inspect-atlas-host';

const inspectAtlasHost = jest.fn<typeof inspectAtlasHostType>();
const loadVersion = jest.fn<ArtifactRegistry['loadVersion']>();
const artifactRegistry = { loadVersion } as unknown as ArtifactRegistry;
const fetch = jest.fn<typeof globalThis.fetch>();
const setInterval = jest.fn<(callback: () => void, ms: number) => number>();

jest.unstable_mockModule('../host/artifact-registry/artifact-registry', () => ({
  createArtifactRegistry: () => artifactRegistry,
}));
jest.unstable_mockModule(
  '../host/inspect-atlas-host/inspect-atlas-host',
  () => ({ inspectAtlasHost }),
);

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

export class BadgeScriptDriver {
  private readonly chrome: FakeChrome = installFakeChrome();
  private readonly responses = new Map<string, () => Response>();
  private readonly colorSchemeListeners: Array<() => void> = [];
  private readonly colorSchemeQuery = {
    matches: false,
    addEventListener: (_type: string, listener: () => void) => {
      this.colorSchemeListeners.push(listener);
    },
  };
  private started = false;
  private response: unknown;

  constructor() {
    jest.clearAllMocks();
    jest.resetModules();
    windowListeners
      .splice(0)
      .forEach(([type, listener]) =>
        window.removeEventListener(type, listener),
      );
    document.body.innerHTML = '';
    sessionStorage.clear();
    localStorage.clear();
    globalThis.fetch = fetch;
    inspectAtlasHost.mockResolvedValue(aHostData());
    loadVersion.mockResolvedValue(aManifest());
    window.setInterval = setInterval as unknown as typeof window.setInterval;
    window.matchMedia = () =>
      this.colorSchemeQuery as unknown as MediaQueryList;
    this.given.pageLocation('http://localhost/');
    fetch.mockImplementation(async (input) => {
      const respond = this.responses.get(String(input));

      return respond ? respond() : aJsonResponse(undefined, 404);
    });
  }

  readonly given = {
    pageLocation: (href: string): this => {
      Object.defineProperty(globalThis, 'location', {
        value: { href, hostname: new URL(href).hostname },
        configurable: true,
      });

      return this;
    },
    pageBody: (html: string): this => {
      document.body.innerHTML = html;

      return this;
    },
    darkColorScheme: (dark: boolean): this => {
      this.colorSchemeQuery.matches = dark;

      return this;
    },
    sessionStorageItem: (key: string, value: string): this => {
      sessionStorage.setItem(key, value);

      return this;
    },
    localStorageItem: (key: string, value: string): this => {
      localStorage.setItem(key, value);

      return this;
    },
    extensionStorageItem: (key: string, value: unknown): this => {
      this.chrome.localStorage.set(key, value);

      return this;
    },
    response: (url: string, body: unknown, status = 200): this => {
      this.responses.set(url, () => aJsonResponse(body, status));

      return this;
    },
    hostData: (hostData: HostData): this => {
      inspectAtlasHost.mockResolvedValue(hostData);

      return this;
    },
    hostInspectionFailure: (reason: string): this => {
      inspectAtlasHost.mockRejectedValue(new Error(reason));

      return this;
    },
    loadedVersion: (manifest: Manifest): this => {
      loadVersion.mockResolvedValue(manifest);

      return this;
    },
    versionLoadFailure: (reason: string): this => {
      loadVersion.mockRejectedValue(new Error(reason));

      return this;
    },
  };

  readonly when = {
    started: async (): Promise<this> => {
      await this.start();

      return this;
    },
    overridesStoredAndEventFired: async (
      document: unknown,
      eventType: string,
    ): Promise<this> => {
      await this.start();
      sessionStorage.setItem(
        'atlas.runtime-overrides',
        JSON.stringify(document),
      );
      window.dispatchEvent(new Event(eventType));
      await flushAsyncWork();

      return this;
    },
    overridesStoredAndIntervalElapsed: async (
      document: unknown,
    ): Promise<this> => {
      await this.start();
      sessionStorage.setItem(
        'atlas.runtime-overrides',
        JSON.stringify(document),
      );
      setInterval.mock.calls.forEach(([callback]) => callback());
      await flushAsyncWork();

      return this;
    },
    colorSchemeChanged: async (dark: boolean): Promise<this> => {
      await this.start();
      this.colorSchemeQuery.matches = dark;
      this.colorSchemeListeners.forEach((listener) => listener());
      await flushAsyncWork();

      return this;
    },
    messageReceived: async (message: unknown): Promise<this> => {
      await this.start();
      this.response = await this.chrome.emitRuntimeMessage(message);

      return this;
    },
  };

  readonly get = {
    response: (): unknown => this.response,
    runtimeMessages: (): unknown[] => this.chrome.runtimeMessages,
    publishedOverrideCounts: (): number[] =>
      this.chrome.runtimeMessages.flatMap((message) =>
        isOverrideCount(message) ? [message.overrideCount] : [],
      ),
    publishedColorSchemes: (): string[] =>
      this.chrome.runtimeMessages.flatMap((message) =>
        isActionTheme(message) ? [message.colorScheme] : [],
      ),
    refreshIntervalsMs: (): number[] =>
      setInterval.mock.calls.map(([, ms]) => ms),
    fetchedUrls: (): string[] =>
      fetch.mock.calls.map(([input]) => String(input)),
    inspectedDocumentKeys: (): string[] =>
      inspectAtlasHost.mock.calls.map(([documentKey]) => documentKey),
    loadedVersionKeys: (): Array<[string, string]> =>
      loadVersion.mock.calls.map(([artifactKey, versionKey]) => [
        artifactKey,
        versionKey,
      ]),
  };

  private async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await import('./badge-script');
    await flushAsyncWork();
  }
}

function flushAsyncWork(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function isOverrideCount(
  message: unknown,
): message is { overrideCount: number } {
  return (
    typeof message === 'object' &&
    message !== null &&
    'overrideCount' in message
  );
}

function isActionTheme(message: unknown): message is { colorScheme: string } {
  return (
    typeof message === 'object' && message !== null && 'colorScheme' in message
  );
}

function aJsonResponse(body: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}
