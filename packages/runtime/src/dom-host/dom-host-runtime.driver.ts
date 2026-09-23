import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import type { AtlasHostCatalog, AtlasManifest } from '@atlas/schema';
import {
  aHostCatalog,
  aHostRuntimeConfig,
  createMemoryNavigation,
} from '@atlas/testkit';
import type { AtlasHostRuntime } from '../host-runtime/host-runtime.types.js';
import type { LoadRemoteModule } from '../loader/native-federation.types.js';
import type { AtlasRuntimeObserver } from '../observability/observability.types.js';
import { flushAsyncWork } from '../shared/async.testkit.js';
import { startDomHostRuntime } from './dom-host-runtime.js';
import type { ReportNavigationItems } from './dom-host.types.js';
import { AtlasHostAnchorRegistry } from './host-anchors.js';

export class DomHostRuntimeDriver {
  readonly hostId = faker.string.uuid();
  private readonly document = document.implementation.createHTMLDocument();
  private readonly anchors = new AtlasHostAnchorRegistry();
  private readonly navigation = createMemoryNavigation();
  private readonly runtimeConfig = aHostRuntimeConfig({
    hostId: this.hostId,
    artifactRegistryUrl: 'http://localhost:4173/atlas',
  });
  private catalog: AtlasHostCatalog = aHostCatalog({ hostId: this.hostId });
  private readonly loadRemoteModule = jest
    .fn<LoadRemoteModule>()
    .mockResolvedValue({ mount() {} });
  private readonly observe = jest.fn<AtlasRuntimeObserver>();
  private readonly onNavigationChange = jest.fn<ReportNavigationItems>();
  private readonly onInfrastructureReady = jest.fn<() => void>();
  private readonly consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  private runtime: AtlasHostRuntime | undefined;
  private error: unknown;

  constructor() {
    this.consoleError.mockClear();
  }

  readonly given = {
    catalogApps: (apps: AtlasManifest[]) => {
      this.catalog = aHostCatalog({ hostId: this.hostId, apps });

      return this;
    },
    catalogForHost: (hostId: string) => {
      this.catalog = aHostCatalog({ hostId });

      return this;
    },
    remoteModuleFailing: (error: Error) => {
      this.loadRemoteModule.mockRejectedValue(error);

      return this;
    },
    slotAnchor: (slot: string) => {
      this.anchors.register('slot', this.createAnchorElement('aside'), slot);

      return this;
    },
    navigationAnchor: () => {
      this.anchors.register('navigation', this.createAnchorElement('nav'));

      return this;
    },
  };

  readonly when = {
    started: async () => {
      try {
        this.runtime = await startDomHostRuntime({
          options: {
            anchors: this.anchors,
            runtimeConfig: this.runtimeConfig,
            catalog: this.catalog,
            federation: {
              initFederation: async () => undefined,
              loadRemoteModule: this.loadRemoteModule,
            },
            observe: this.observe,
            onNavigationChange: this.onNavigationChange,
          },
          services: { createNavigation: () => this.navigation },
          document: this.document,
          onInfrastructureReady: this.onInfrastructureReady,
        });
      } catch (error) {
        this.error = error;
      }

      await flushAsyncWork();
    },
    slotAnchorRegistered: async (slot: string) => {
      this.anchors.register('slot', this.createAnchorElement('aside'), slot);

      await flushAsyncWork();
    },
    navigatedTo: async (path: string) => {
      this.navigation.navigate(path);

      await flushAsyncWork();
    },
    stopped: () => this.runtime!.stop(),
  };

  readonly get = {
    loadRemoteModuleMock: () => this.loadRemoteModule,
    observeMock: () => this.observe,
    appStates: () =>
      this.observe.mock.calls
        .map(([event]) => event)
        .flatMap((event) => (event.type === 'app.state' ? [event.state] : [])),
    onNavigationChangeMock: () => this.onNavigationChange,
    onInfrastructureReadyMock: () => this.onInfrastructureReady,
    consoleErrorMock: () => this.consoleError,
    navigationLinkLabels: () =>
      [...this.anchors.get('navigation')!.querySelectorAll('a')].map(
        (link) => link.textContent ?? '',
      ),
    lastNavigationItems: () => this.onNavigationChange.mock.calls.at(-1)![0],
    error: () => this.error,
  };

  private createAnchorElement(tagName: string): HTMLElement {
    return this.document.body.appendChild(this.document.createElement(tagName));
  }
}
