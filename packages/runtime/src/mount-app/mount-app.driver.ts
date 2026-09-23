import { jest } from '@jest/globals';
import type { AtlasManifest } from '@atlas/schema';
import type { AtlasAppMountRequest } from '@atlas/sdk/lifecycle';
import { createTestHostSdk } from '@atlas/testkit';
import type { AtlasMountedApp } from '../host-runtime/host-runtime.types.js';
import type { AtlasRemoteTrustPolicy } from '../loader/trust/trust-policy.types.js';
import type { StylesheetOutcome } from '../stylesheets/stylesheets.driver.js';
import { mountApp } from './mount-app.js';
import type { ImportAppRemote } from './mount-app.types.js';

export class MountAppDriver {
  readonly sdk = createTestHostSdk();
  private readonly document = document.implementation.createHTMLDocument();
  private readonly container = this.document.body.appendChild(
    this.document.createElement('div'),
  );
  private readonly createElement = this.document.createElement.bind(
    this.document,
  );
  private stylesheetOutcome: StylesheetOutcome = 'load';
  private routeTitle: string | undefined;
  private trustPolicy: AtlasRemoteTrustPolicy | undefined;
  private readonly requests: AtlasAppMountRequest[] = [];
  private readonly entryUnmount = jest.fn<() => void>();
  private readonly importRemote = jest.fn<ImportAppRemote>(async () => ({
    mount: (request) => {
      this.requests.push(request);

      return { unmount: this.entryUnmount };
    },
  }));
  private mounted: AtlasMountedApp | undefined;
  private error: unknown;

  constructor() {
    jest
      .spyOn(this.document, 'createElement')
      .mockImplementation(
        (tagName: string, options?: ElementCreationOptions) => {
          const element = this.createElement(tagName, options);

          if (tagName === 'link') {
            queueMicrotask(() =>
              element.dispatchEvent(new Event(this.stylesheetOutcome)),
            );
          }

          return element;
        },
      );
  }

  readonly given = {
    documentTitle: (title: string) => {
      this.document.title = title;

      return this;
    },
    routeTitle: (title: string) => {
      this.routeTitle = title;

      return this;
    },
    trustPolicy: (policy: AtlasRemoteTrustPolicy) => {
      this.trustPolicy = policy;

      return this;
    },
    stylesheetOutcome: (outcome: StylesheetOutcome) => {
      this.stylesheetOutcome = outcome;

      return this;
    },
    entryFailing: (error: Error) => {
      this.importRemote.mockResolvedValue({
        mount: () => {
          throw error;
        },
      });

      return this;
    },
    entrySettingTabTitle: (title: string) => {
      this.importRemote.mockResolvedValue({
        mount: (request) => {
          this.requests.push(request);
          request.context.route.setTabTitle(title);
        },
      });

      return this;
    },
  };

  readonly when = {
    mounted: async (manifest: AtlasManifest) => {
      try {
        this.mounted = await mountApp({
          hostId: this.sdk.hostId,
          sdk: this.sdk,
          manifest,
          container: this.container,
          importRemote: this.importRemote,
          ...(this.routeTitle !== undefined
            ? { routeTitle: this.routeTitle }
            : {}),
          ...(this.trustPolicy ? { trustPolicy: this.trustPolicy } : {}),
        });
      } catch (error) {
        this.error = error;
      }
    },
    unmounted: () => this.mounted!.unmount(),
  };

  readonly get = {
    lastRequest: () => this.requests.at(-1)!,
    container: () => this.container,
    headLinks: () => [...this.document.head.querySelectorAll('link')],
    documentTitle: () => this.document.title,
    importRemoteMock: () => this.importRemote,
    entryUnmountMock: () => this.entryUnmount,
    error: () => this.error,
  };
}
