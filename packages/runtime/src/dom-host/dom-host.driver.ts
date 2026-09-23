import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import {
  aHostCatalog,
  aHostRuntimeConfig,
  createMemoryNavigation,
} from '@atlas/testkit';
import type { AtlasHostRuntime } from '../host-runtime/host-runtime.types.js';
import { aFederationAdapter } from '../loader/native-federation.testkit.js';
import type { AtlasRuntimeObserver } from '../observability/observability.types.js';
import { flushAsyncWork } from '../shared/async.testkit.js';
import { startDomHost } from './dom-host.js';
import type { CreateHostNavigation } from './dom-host.types.js';
import { AtlasHostAnchorRegistry } from './host-anchors.js';

export class DomHostDriver {
  private readonly hostId = faker.string.uuid();
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
  private catalogHostId = this.hostId;
  private runtime: AtlasHostRuntime | undefined;
  private error: unknown;

  constructor() {
    this.consoleError.mockClear();
    this.anchors.register('status', this.status);
  }

  readonly given = {
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
  };

  readonly when = {
    started: async () => {
      this.error = undefined;

      try {
        this.runtime = await startDomHost(
          {
            anchors: this.anchors,
            document: this.document,
            runtimeConfig: aHostRuntimeConfig({ hostId: this.hostId }),
            catalog: aHostCatalog({ hostId: this.catalogHostId }),
            federation: aFederationAdapter(),
            observe: this.observe,
          },
          { createNavigation: this.createNavigation },
        );
      } catch (error) {
        this.error = error;
      }
    },
    retryClicked: async () => {
      this.status.querySelector('button')!.click();

      await flushAsyncWork();
    },
  };

  readonly get = {
    runtimeHostId: () => this.runtime!.hostId,
    statusText: () => this.status.textContent ?? '',
    statusState: () => this.status.dataset.atlasState,
    eventTypes: () => this.observe.mock.calls.map(([event]) => event.type),
    consoleErrorMock: () => this.consoleError,
    error: () => this.error,
  };
}
