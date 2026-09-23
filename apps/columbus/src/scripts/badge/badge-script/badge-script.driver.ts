import { jest } from '@jest/globals';
import type { ArtifactVersion } from '../../../types/artifact-version';
import type { AtlasRuntimeError, HostData } from '../../../types/host-data';
import {
  type FakeChrome,
  installFakeChrome,
} from '../../../testkit/chrome.testkit';
import type { ArtifactRegistry } from '../../../utils/artifact-registry/artifact-registry';
import type { inspectAtlasHost as inspectAtlasHostType } from '../../../utils/inspect-atlas-host/inspect-atlas-host';
import type {
  readRuntimeErrors as readRuntimeErrorsType,
  readVisibleAppIds as readVisibleAppIdsType,
} from '../../../utils/page-runtime-state/page-runtime-state';
import {
  isActionThemeMessage,
  isOverrideCountMessage,
} from '../../../utils/messages/messages';

const inspectAtlasHost = jest.fn<typeof inspectAtlasHostType>();
const readVisibleAppIds = jest.fn<typeof readVisibleAppIdsType>();
const readRuntimeErrors = jest.fn<typeof readRuntimeErrorsType>();
const artifactRegistry = {
  readRegistry: jest.fn<ArtifactRegistry['readRegistry']>(),
  readVersions: jest.fn<ArtifactRegistry['readVersions']>(),
  loadManifest: jest.fn<ArtifactRegistry['loadManifest']>(),
  loadVersion: jest.fn<ArtifactRegistry['loadVersion']>(),
};
const fetch =
  jest.fn<
    (
      input: string | URL,
      init?: RequestInit,
    ) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>
  >();
const setInterval = jest.fn<(callback: () => void, ms: number) => number>();

jest.unstable_mockModule(
  '../../../utils/artifact-registry/artifact-registry',
  () => ({
    createArtifactRegistry: () => artifactRegistry,
  }),
);
jest.unstable_mockModule(
  '../../../utils/inspect-atlas-host/inspect-atlas-host',
  () => ({ inspectAtlasHost }),
);
jest.unstable_mockModule(
  '../../../utils/page-runtime-state/page-runtime-state',
  () => ({ readVisibleAppIds, readRuntimeErrors }),
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
    fetch.mockResolvedValue({ ok: false, status: 404, json: async () => null });
    Object.assign(globalThis, { fetch });
    Object.assign(window, {
      setInterval,
      matchMedia: () => this.colorSchemeQuery,
    });
  }

  readonly given = {
    pageLocation: (href: string) => {
      Object.defineProperty(globalThis, 'location', {
        value: { href, hostname: new URL(href).hostname },
        configurable: true,
      });

      return this;
    },
    pageBody: (html: string) => {
      document.body.innerHTML = html;

      return this;
    },
    darkColorScheme: (dark: boolean) => {
      this.colorSchemeQuery.matches = dark;

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
    extensionStorageItem: (key: string, value: unknown) => {
      this.chrome.localStorage.set(key, value);

      return this;
    },
    fetchJson: (body: unknown) => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => body,
      });

      return this;
    },
    fetchStatus: (status: number) => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status,
        json: async () => null,
      });

      return this;
    },
    hostData: (hostData: HostData) => {
      inspectAtlasHost.mockResolvedValue(hostData);

      return this;
    },
    hostInspectionFailure: (error: Error) => {
      inspectAtlasHost.mockRejectedValue(error);

      return this;
    },
    loadedVersion: (manifest: ArtifactVersion) => {
      artifactRegistry.loadVersion.mockResolvedValue(manifest);

      return this;
    },
    versionLoadFailure: (error: Error) => {
      artifactRegistry.loadVersion.mockRejectedValue(error);

      return this;
    },
    visibleAppIds: (visibleAppIds: string[]) => {
      readVisibleAppIds.mockReturnValue(visibleAppIds);

      return this;
    },
    runtimeErrors: (runtimeErrors: AtlasRuntimeError[]) => {
      readRuntimeErrors.mockReturnValue(runtimeErrors);

      return this;
    },
  };

  readonly when = {
    started: () => this.start(),
    overridesStoredAndEventFired: async (
      document: unknown,
      eventType: string,
    ) => {
      await this.start();
      sessionStorage.setItem(
        'atlas.runtime-overrides',
        JSON.stringify(document),
      );
      window.dispatchEvent(new Event(eventType));
      await flushAsyncWork();
    },
    overridesStoredAndIntervalElapsed: async (document: unknown) => {
      await this.start();
      sessionStorage.setItem(
        'atlas.runtime-overrides',
        JSON.stringify(document),
      );
      setInterval.mock.calls.forEach(([callback]) => callback());
      await flushAsyncWork();
    },
    colorSchemeChanged: async (dark: boolean) => {
      await this.start();
      this.colorSchemeQuery.matches = dark;
      this.colorSchemeListeners.forEach((listener) => listener());
      await flushAsyncWork();
    },
    messageReceived: async (message: unknown) => {
      await this.start();
      this.response = await this.chrome.emitRuntimeMessage(message);
    },
  };

  readonly get = {
    response: () => this.response,
    publishedOverrideCounts: () =>
      this.chrome.runtimeMessages
        .filter(isOverrideCountMessage)
        .map(({ overrideCount }) => overrideCount),
    publishedColorSchemes: () =>
      this.chrome.runtimeMessages
        .filter(isActionThemeMessage)
        .map(({ colorScheme }) => colorScheme),
    setInterval: () => setInterval,
    fetch: () => fetch,
    inspectAtlasHost: () => inspectAtlasHost,
    loadVersion: () => artifactRegistry.loadVersion,
  };

  private async start() {
    if (this.started) return;
    this.started = true;
    await import('./badge-script');
    await flushAsyncWork();
  }
}

function flushAsyncWork(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
