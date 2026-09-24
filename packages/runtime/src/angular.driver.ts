import '@angular/compiler';
import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import {
  Component,
  provideZonelessChangeDetection,
  signal,
  type ApplicationRef,
  type WritableSignal,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { injectAtlasSdk } from '@atlas/sdk/angular';
import { createAtlasSdk } from '@atlas/sdk/host';
import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import { aHostRuntimeConfig, createMemoryNavigation } from '@atlas/testkit';
import { aFederationAdapter } from './loader/native-federation.testkit.js';
import type {
  AtlasHostRuntime,
  UpdateHostData,
} from './host-runtime/host-runtime.types.js';
import type {
  DomHostOptions,
  DomHostServices,
  RenderHostLoading,
  ReportSdkCreated,
} from './dom-host/dom-host.types.js';
import { publishAtlasNavigationItems } from './dom-host/host-navigation.js';
import { aNavigationItem } from './dom-host/host-navigation.testkit.js';

type StartDomHostForHostSdk = (
  options: DomHostOptions<HostSdk>,
  services: DomHostServices<HostSdk>,
) => Promise<AtlasHostRuntime<HostSdk>>;

const startDomHost = jest.fn<StartDomHostForHostSdk>();

jest.unstable_mockModule('./dom-host/dom-host.js', () => ({ startDomHost }));

const {
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
  private readonly renderHostLoading = jest.fn<RenderHostLoading>();
  private routerUrl = '/';
  private app: ApplicationRef | undefined;
  private runtime: AtlasHostRuntime<HostSdk> | undefined;
  private unmount: (() => void | Promise<void>) | undefined;
  private hostName: string | undefined = faker.company.name();
  private runtimeConfig = aHostRuntimeConfig({ hostId: this.hostId });
  private catalog: AtlasHostCatalog | undefined;
  private root: HTMLElement | null = null;
  private eagerSdkComponent = false;
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
        { onSdkCreated: this.onSdkCreated },
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
      const container = document.createElement('div');

      document.body.replaceChildren(container);

      try {
        const mounted = await bootstrapAngularHost<HostSdk>({
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
        this.unmount = mounted.unmount;
      } catch (error) {
        this.error = error;
      }
    },
    angularHostMounted: async () => {
      const container = document.createElement('div');

      document.body.replaceChildren(container);

      const mount = defineAngularHost<HostSdk>({
        config: {
          id: this.hostId,
          ...(this.hostName ? { name: this.hostName } : {}),
        },
        component: HostRoot,
        appConfig: { providers: [provideZonelessChangeDetection()] },
        sdkOptions: () => ({
          hostData: { region: this.region },
          renderHostLoading: this.renderHostLoading,
        }),
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
    renderHostLoadingMock: () => this.renderHostLoading,
    rootConnected: () => this.root?.isConnected ?? false,
    error: () => this.error,
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
