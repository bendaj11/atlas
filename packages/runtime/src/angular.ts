import {
  Component,
  effect,
  Injectable,
  isSignal,
  signal,
  type ApplicationConfig,
  type Injector,
  type OnDestroy,
  type Signal,
  type Type,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  createHostNavigation,
  provideAtlasSdk,
  type LocationLike,
  type RouterLike,
} from '@atlas/sdk/angular';
import type { AtlasEventMap, AtlasSdk as AtlasSdkValue } from '@atlas/sdk';
import type { AtlasHostClientEntry } from '@atlas/sdk/lifecycle';
import { startDomHost, type DomHostOptions } from './dom-host.js';
import type { DomRuntimeOptions } from './dom-host-options.js';
import {
  readAtlasNavigationItems,
  subscribeAtlasNavigationItems,
  type AtlasHostNavigationItem,
  type AtlasHostRuntime,
} from './index.js';
import type { AtlasHostDataOf } from '@atlas/sdk/host';
export {
  AtlasAngularHostAnchors,
  AtlasHostLayout,
  AtlasHostStatus,
  AtlasNavigation,
  AtlasRouteOutlet,
  AtlasSlot,
} from './angular-anchors.js';

@Component({
  selector: 'atlas-default-host-route',
  standalone: true,
  template: '',
})
export class AtlasDefaultHostRouteComponent {}

type AngularHostDataInput<THostSdk extends object> = {
  [Key in keyof AtlasHostDataOf<THostSdk>]:
    AtlasHostDataOf<THostSdk>[Key] | Signal<AtlasHostDataOf<THostSdk>[Key]>;
};

type AngularHostDataOption<THostSdk extends object> =
  keyof AtlasHostDataOf<THostSdk> extends never
    ? { hostData?: AngularHostDataInput<THostSdk> }
    : { hostData: AngularHostDataInput<THostSdk> };

export type HostOptions<THostSdk extends object = {}> = Omit<
  DomHostOptions<THostSdk>,
  'hostData'
> & {
  router: RouterLike;
  location: LocationLike;
  /** Injector used by Atlas to dispose Signal-backed host data with the host runtime. */
  hostDataInjector?: Injector;
} & AngularHostDataOption<THostSdk>;

/** Product SDK configuration supplied by `src/app/host.config.ts`. */
export type HostSdkOptions<THostSdk extends object = {}> = Omit<
  HostOptions<THostSdk>,
  keyof DomRuntimeOptions | 'router' | 'location' | 'hostDataInjector'
> &
  Pick<HostOptions<THostSdk>, 'observe'>;

type HostMountRequest = Parameters<AtlasHostClientEntry['mount']>[0];

export interface AngularHostBootstrapOptions<THostSdk extends object = {}> {
  component: Type<unknown>;
  appConfig: ApplicationConfig;
  request?: HostMountRequest;
  createHostOptions(injector: Injector): HostOptions<THostSdk>;
}

interface AngularHostStartServices<THostSdk extends object> {
  onSdkCreated?(sdk: AtlasSdkValue<THostSdk>): void;
}

/** Bootstraps an Angular host and owns the dynamically mounted root lifecycle. */
export async function bootstrapAngularHost<THostSdk extends object = {}>(
  options: AngularHostBootstrapOptions<THostSdk>,
): Promise<{ unmount(): Promise<void> }> {
  const root = options.request
    ? document.createElement('atlas-host-root')
    : undefined;
  if (root && options.request) options.request.container.append(root);

  const sdkReference = new AngularHostSdkReference<THostSdk>();
  const app = await bootstrapApplication(
    options.component,
    withAtlasSdkProvider(options.appConfig, sdkReference),
  );
  const runtime = await startHost(
    {
      ...options.createHostOptions(app.injector),
      hostDataInjector: app.injector,
    },
    {
      onSdkCreated: (sdk) => sdkReference.set(sdk),
    },
  );

  return {
    async unmount() {
      await runtime.stop();
      app.destroy();
      root?.remove();
    },
  };
}

/** Boots Atlas discovery, Native Federation, SDK providers, routes, slots, and lifecycle for an Angular host. */
export async function startHost<THostSdk extends object = {}>(
  options: HostOptions<THostSdk>,
  services: AngularHostStartServices<THostSdk> = {},
): Promise<AtlasHostRuntime<THostSdk>> {
  const { hostData, hostDataInjector, ...runtimeOptions } = options;
  const domHostOptions = {
    ...runtimeOptions,
    ...(hostData ? { hostData: readAngularHostData(hostData) } : {}),
  } as unknown as DomHostOptions<THostSdk>;
  const runtime = await startDomHost(domHostOptions, {
    beforeNavigation: () => syncAngularRouterWithBrowserUrl(options.router),
    createNavigation: () =>
      createHostNavigation(options.router, options.location),
    ...(services.onSdkCreated ? { onSdkCreated: services.onSdkCreated } : {}),
  });
  const stopHostData =
    hostDataInjector && hostData
      ? observeAngularHostData(hostData, runtime, hostDataInjector)
      : () => undefined;

  return {
    ...runtime,
    async stop() {
      stopHostData();
      await runtime.stop();
    },
  };
}

class AngularHostSdkReference<THostSdk extends object> {
  private sdk: AtlasSdkValue<THostSdk> | undefined;

  set(sdk: AtlasSdkValue<THostSdk>): void {
    this.sdk = sdk;
  }

  get(): AtlasSdkValue<THostSdk> {
    if (this.sdk) return this.sdk;
    throw new Error(
      'Atlas SDK is unavailable until the Angular host runtime starts.',
    );
  }
}

function withAtlasSdkProvider<THostSdk extends object>(
  appConfig: ApplicationConfig,
  sdkReference: AngularHostSdkReference<THostSdk>,
): ApplicationConfig {
  return {
    ...appConfig,
    providers: [
      ...(appConfig.providers ?? []),
      provideAtlasSdk<THostSdk, AtlasEventMap>(() => sdkReference.get()),
    ],
  };
}

@Injectable({ providedIn: 'root' })
export class AtlasNavigationItemsService implements OnDestroy {
  private readonly itemsState = signal<readonly AtlasHostNavigationItem[]>(
    readAtlasNavigationItems(),
  );
  private readonly unsubscribe = subscribeAtlasNavigationItems((items) =>
    this.itemsState.set(items),
  );

  readonly items: Signal<readonly AtlasHostNavigationItem[]> =
    this.itemsState.asReadonly();

  ngOnDestroy(): void {
    this.unsubscribe();
  }
}

async function syncAngularRouterWithBrowserUrl(
  router: RouterLike,
): Promise<void> {
  const browserLocation = globalThis.location;
  if (!browserLocation) return;

  const requestedUrl = `${browserLocation.pathname}${browserLocation.search}${browserLocation.hash}`;
  if (router.url !== requestedUrl) {
    await router.navigateByUrl(requestedUrl, { replaceUrl: true });
  }
}

function readAngularHostData<THostSdk extends object>(
  hostData: AngularHostDataInput<THostSdk>,
): AtlasHostDataOf<THostSdk> {
  return Object.fromEntries(
    Object.entries(hostData).map(([key, value]) => [
      key,
      isAngularHostDataSignal(value) ? value() : value,
    ]),
  ) as AtlasHostDataOf<THostSdk>;
}

function observeAngularHostData<THostSdk extends object>(
  hostData: AngularHostDataInput<THostSdk>,
  runtime: AtlasHostRuntime<THostSdk>,
  injector: Injector,
): () => void {
  const references = Object.entries(hostData)
    .filter((entry): entry is [string, Signal<unknown>] =>
      isAngularHostDataSignal(entry[1]),
    )
    .map(([key, value]) =>
      effect(
        () => {
          runtime.updateHostData({ [key]: value() } as Partial<
            AtlasHostDataOf<THostSdk>
          >);
        },
        { injector, manualCleanup: true },
      ),
    );

  return () => references.forEach((reference) => reference.destroy());
}

function isAngularHostDataSignal(value: unknown): value is Signal<unknown> {
  return isSignal(value);
}
