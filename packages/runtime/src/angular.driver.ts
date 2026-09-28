import '@angular/compiler';
import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import {
  ApplicationRef,
  Component,
  inject,
  provideAppInitializer,
  provideZonelessChangeDetection,
  signal,
  type Type,
  type WritableSignal,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { injectAtlasSdk } from '@atlas/sdk/angular';
import { createAtlasSdk } from '@atlas/sdk/host';
import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import { aHostRuntimeConfig, createMemoryNavigation } from '@atlas/testkit';
import { flushAsyncWork } from '@atlas/testkit/internal';
import { aFederationAdapter } from './loader/native-federation.testkit.js';
import type {
  AtlasHostRuntime,
  UpdateHostData,
} from './host-runtime/host-runtime.types.js';
import type {
  DomHostOptions,
  DomHostServices,
  ReportSdkCreated,
} from './dom-host/dom-host.types.js';
import { publishAtlasNavigationItems } from './dom-host/host-navigation.js';
import type { MountedAngularHost } from './angular.types.js';
import { aNavigationItem } from './dom-host/host-navigation.testkit.js';

type StartDomHostForHostSdk = (
  options: DomHostOptions<HostSdk>,
  services: DomHostServices<HostSdk>,
) => Promise<AtlasHostRuntime<HostSdk>>;

const startDomHost = jest.fn<StartDomHostForHostSdk>();

jest.unstable_mockModule('./dom-host/dom-host.js', () => ({ startDomHost }));

const {
  ATLAS_NOT_FOUND_COMPONENT,
  AtlasNavigationItemsService,
  bootstrapAngularHost,
  defineAngularHost,
  startHost,
} = await import('./angular.js');

interface HostSdk {
  readonly hostData: { readonly region: string };
}

@Component({ selector: 'atlas-host-root', standalone: true, template: '' })
class HostRoot {}

@Component({
  selector: 'atlas-test-not-found',
  standalone: true,
  template: '<p data-testid="host-not-found"></p>',
})
export class HostNotFound {}

@Component({ selector: 'atlas-test-loading', standalone: true, template: '' })
export class HostLoading {}

@Component({ selector: 'atlas-host-root', standalone: true, template: '' })
class EagerSdkHostRoot {
  readonly sdk = injectAtlasSdk();
}

export class AngularAdapterDriver {
  readonly hostId = faker.string.uuid();
  readonly sdk = createAtlasSdk<HostSdk>({
    hostId: this.hostId,
    navigation: createMemoryNavigation(),
    hostData: { region: faker.location.countryCode() },
  });
  readonly region: WritableSignal<string> = signal(
    faker.location.countryCode(),
  );
  private readonly updateHostData = jest.fn<UpdateHostData<HostSdk>>();
  private readonly stop = jest.fn<() => Promise<void>>(async () => undefined);
  private readonly navigateByUrl = jest.fn<
    (url: string, options?: object) => Promise<boolean>
  >(async () => true);
  private readonly onSdkCreated = jest.fn<ReportSdkCreated<HostSdk>>();
  private readonly onReady = jest.fn<() => void>();
  private routerUrl = '/';
  private app: ApplicationRef | undefined;
  private runtime: AtlasHostRuntime<HostSdk> | undefined;
  private unmount: (() => void | Promise<void>) | undefined;
  private mounting: Promise<MountedAngularHost> | undefined;
  private hostName: string | undefined = faker.company.name();
  private runtimeConfig = aHostRuntimeConfig({ hostId: this.hostId });
  private catalog: AtlasHostCatalog | undefined;
  private notFoundComponent: Type<unknown> | undefined;
  private loadingComponent: Type<unknown> | undefined;
  private root: HTMLElement | null = null;
  private eagerSdkComponent = false;
  private readonly container = document.createElement('div');
  private placeholder: Node | undefined;
  private error: unknown;

  constructor() {
    startDomHost.mockReset();

    startDomHost.mockImplementation(async (_options, services) => {
      services.onSdkCreated?.(this.sdk);

      await services.beforeNavigation?.();

      return {
        hostId: this.hostId,
        manifests: [],
        retry: async () => undefined,
        updateHostData: this.updateHostData,
        stop: this.stop,
      };
    });

    window.history.replaceState(null, '', '/');
  }

  readonly given = {
    placeholder: (placeholder: Node) => {
      this.placeholder = placeholder;

      return this;
    },
    domHostStart: (start: Promise<AtlasHostRuntime<HostSdk>>) => {
      startDomHost.mockReturnValueOnce(start);

      return this;
    },
    eagerSdkComponent: () => {
      this.eagerSdkComponent = true;

      return this;
    },
    routerUrl: (url: string) => {
      this.routerUrl = url;

      return this;
    },
    browserUrl: (url: string) => {
      window.history.replaceState(null, '', url);

      return this;
    },
    hostName: (hostName: string | undefined) => {
      this.hostName = hostName;

      return this;
    },
    runtimeConfig: (runtimeConfig: AtlasHostRuntimeConfig) => {
      this.runtimeConfig = runtimeConfig;

      return this;
    },
    catalog: (catalog: AtlasHostCatalog) => {
      this.catalog = catalog;

      return this;
    },
    loadingComponent: (loadingComponent: Type<unknown>) => {
      this.loadingComponent = loadingComponent;

      return this;
    },
    notFoundComponent: (notFoundComponent: Type<unknown>) => {
      this.notFoundComponent = notFoundComponent;

      return this;
    },
  };

  readonly when = {
    hostStarted: async () => {
      document.body.replaceChildren(document.createElement('atlas-host-root'));

      this.app = await bootstrapApplication(HostRoot, {
        providers: [provideZonelessChangeDetection()],
      });
      this.runtime = await startHost<HostSdk>(
        {
          ...this.hostOptions(),
          hostData: { region: this.region },
          hostDataInjector: this.app.injector,
        },
        { onSdkCreated: this.onSdkCreated, onReady: this.onReady },
      );

      this.app.tick();
    },
    regionChanged: async (region: string) => {
      this.region.set(region);

      this.app!.tick();
      await this.app!.whenStable();
    },
    runtimeStopped: () => this.runtime!.stop(),
    angularHostBootstrapped: async () => {
      await this.when.angularHostBootstrapRequested();

      try {
        this.unmount = (await this.mounting!).unmount;
      } catch (error) {
        this.error = error;
      }
    },
    angularHostBootstrapRequested: async () => {
      const container = this.container;

      if (this.placeholder) container.append(this.placeholder);

      document.body.replaceChildren(container);

      this.mounting = bootstrapAngularHost<HostSdk>({
        component: this.eagerSdkComponent ? EagerSdkHostRoot : HostRoot,
        appConfig: { providers: [provideZonelessChangeDetection()] },
        request: {
          container,
          runtimeConfig: this.hostOptions().runtimeConfig,
        },
        createHostOptions: () => ({
          ...this.hostOptions(),
          hostData: { region: this.region() },
        }),
      });
      this.root = container.querySelector<HTMLElement>('atlas-host-root');

      this.mounting.catch(() => undefined);

      await flushAsyncWork();
    },
    readyReported: async () => {
      startDomHost.mock.calls.at(-1)![1].onReady!();

      await flushAsyncWork();
    },
    angularHostMounted: async () => {
      const container = this.container;

      document.body.replaceChildren(container);

      const mount = defineAngularHost<HostSdk>({
        config: {
          id: this.hostId,
          ...(this.hostName ? { name: this.hostName } : {}),
        },
        component: HostRoot,
        appConfig: {
          providers: [
            provideZonelessChangeDetection(),
            provideAppInitializer(() => {
              this.app = inject(ApplicationRef);
            }),
          ],
        },
        ...(this.notFoundComponent
          ? { notFoundComponent: this.notFoundComponent }
          : {}),
        ...(this.loadingComponent
          ? { loadingComponent: this.loadingComponent }
          : {}),
        sdkOptions: () => ({ hostData: { region: this.region } }),
      });
      const mounted = await mount({
        container,
        runtimeConfig: this.runtimeConfig,
        ...(this.catalog ? { catalog: this.catalog } : {}),
      });

      this.unmount = mounted?.unmount;
    },
    unmounted: async () => {
      await this.unmount!();
    },
    navigationItemsPublished: (labels: string[]) => {
      publishAtlasNavigationItems(
        document,
        labels.map((label) => aNavigationItem({ label })),
      );
    },
  };

  readonly get = {
    startDomHostMock: () => startDomHost,
    startedOptions: () => startDomHost.mock.calls.at(-1)![0],
    startedNavigationPathname: async () =>
      (
        await startDomHost.mock.calls.at(-1)![1].createNavigation()
      ).getCurrentLocation().pathname,
    updateHostDataMock: () => this.updateHostData,
    stopMock: () => this.stop,
    navigateByUrlMock: () => this.navigateByUrl,
    onSdkCreatedMock: () => this.onSdkCreated,
    onReadyMock: () => this.onReady,
    startedServices: () => startDomHost.mock.calls.at(-1)![1],
    rootConnected: () => this.root?.isConnected ?? false,
    rootHidden: () => this.root?.hidden,
    requestContainer: () => this.container,
    error: () => this.error,
    notFoundComponent: () =>
      this.app!.injector.get(ATLAS_NOT_FOUND_COMPONENT, null),
    navigationItemLabels: () =>
      this.app!.injector.get(AtlasNavigationItemsService)
        .items()
        .map((item) => item.label),
  };

  private hostOptions() {
    const driver = this;

    return {
      runtimeConfig: aHostRuntimeConfig({ hostId: this.hostId }),
      federation: aFederationAdapter(),
      router: {
        get url() {
          return driver.routerUrl;
        },
        navigateByUrl: this.navigateByUrl,
        events: { subscribe: () => ({ unsubscribe: () => undefined }) },
      },
      location: { back: () => undefined },
    };
  }
}
