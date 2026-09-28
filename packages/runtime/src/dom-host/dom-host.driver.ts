import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import type { AtlasManifest } from '@atlas/schema';
import type { AtlasNavigation } from '@atlas/sdk/navigation';
import {
  aHostCatalog,
  aHostRuntimeConfig,
  createMemoryNavigation,
} from '@atlas/testkit';
import { flushAsyncWork } from '@atlas/testkit/internal';
import type { AtlasHostRuntime } from '../host-runtime/host-runtime.types.js';
import { aFederationAdapter } from '../loader/native-federation.testkit.js';
import type { LoadRemoteModule } from '../loader/native-federation.types.js';
import type { AtlasRuntimeObserver } from '../observability/observability.types.js';
import { startDomHost } from './dom-host.js';
import type { CreateHostNavigation } from './dom-host.types.js';
import { AtlasHostAnchorRegistry } from './host-anchors.js';

export class DomHostDriver {
  readonly hostId = faker.string.uuid();
  private readonly document = document.implementation.createHTMLDocument();
  private readonly anchors = new AtlasHostAnchorRegistry();
  private readonly status = this.document.body.appendChild(
    this.document.createElement('div'),
  );
  private readonly observe = jest.fn<AtlasRuntimeObserver>();
  private readonly consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  private readonly createNavigation = jest
    .fn<CreateHostNavigation>()
    .mockImplementation(() => createMemoryNavigation());
  private readonly onReady = jest.fn<() => void>();
  private readonly loadRemoteModule = jest.fn<LoadRemoteModule>();
  private catalogHostId = this.hostId;
  private catalogApps: AtlasManifest[] = [];
  private runtime: AtlasHostRuntime | undefined;
  private error: unknown;

  constructor() {
    this.consoleError.mockClear();
  }

  readonly given = {
    statusAnchor: () => {
      this.anchors.register('status', this.status);

      return this;
    },
    slotAnchor: (slot: string) => {
      this.anchors.register(
        'slot',
        this.document.body.appendChild(this.document.createElement('aside')),
        slot,
      );

      return this;
    },
    catalogApps: (apps: AtlasManifest[]) => {
      this.catalogApps = apps;

      return this;
    },
    remoteModuleLoad: (load: ReturnType<LoadRemoteModule>) => {
      this.loadRemoteModule.mockReturnValue(load);

      return this;
    },
    catalogForOtherHost: () => {
      this.catalogHostId = faker.string.uuid();

      return this;
    },
    navigationFailingOnce: (error: Error) => {
      this.createNavigation.mockImplementationOnce(() => {
        throw error;
      });

      return this;
    },
    navigationLoadOnce: (load: Promise<AtlasNavigation>) => {
      this.createNavigation.mockReturnValueOnce(load);

      return this;
    },
  };

  readonly when = {
    started: async () => {
      this.error = undefined;

      try {
        this.runtime = await this.start();
      } catch (error) {
        this.error = error;
      }
    },
    startRequested: async () => {
      void this.start();

      await flushAsyncWork();
    },
    retryClicked: async () => {
      this.status.querySelector('button')!.click();

      await flushAsyncWork();
    },
  };

  readonly get = {
    runtimeHostId: () => this.runtime!.hostId,
    statusText: () => this.status.textContent ?? '',
    statusState: () =>
      this.status.querySelector<HTMLElement>('[data-atlas-host-status]')
        ?.dataset.atlasState,
    hostStatuses: () =>
      this.status.querySelectorAll('[data-atlas-host-status]'),
    onReadyMock: () => this.onReady,
    createNavigationMock: () => this.createNavigation,
    eventTypes: () => this.observe.mock.calls.map(([event]) => event.type),
    consoleErrorMock: () => this.consoleError,
    error: () => this.error,
  };

  private start() {
    return startDomHost(
      {
        anchors: this.anchors,
        document: this.document,
        runtimeConfig: aHostRuntimeConfig({
          hostId: this.hostId,
          artifactRegistryUrl: 'http://localhost:4173/atlas',
        }),
        catalog: aHostCatalog({
          hostId: this.catalogHostId,
          apps: this.catalogApps,
        }),
        federation: aFederationAdapter({
          loadRemoteModule: this.loadRemoteModule,
        }),
        observe: this.observe,
      },
      { createNavigation: this.createNavigation, onReady: this.onReady },
    );
  }
}
