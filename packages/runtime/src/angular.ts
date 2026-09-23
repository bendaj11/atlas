import {
  Component,
  effect,
  Injectable,
  isSignal,
  signal,
  type Injector,
  type OnDestroy,
  type Signal,
  type ApplicationConfig,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  createHostNavigation,
  provideAtlasSdk,
  type RouterLike,
} from '@atlas/sdk/angular';
import type { AtlasEventMap, AtlasSdk } from '@atlas/sdk';
import type { AtlasHostDataOf } from '@atlas/sdk/host';
import { AtlasSdkNotReadyError } from './adapters/adapter.errors.js';
import { startDomHost } from './dom-host/dom-host.js';
import type { DomHostOptions } from './dom-host/dom-host.types.js';
import {
  readAtlasNavigationItems,
  subscribeAtlasNavigationItems,
} from './dom-host/host-navigation.js';
import type { AtlasHostNavigationItem } from './dom-host/host-navigation.types.js';
import type { AtlasHostRuntime } from './host-runtime/host-runtime.types.js';
import type {
  AngularHostBootstrapOptions,
  AngularHostDataInput,
  AngularHostStartServices,
  HostOptions,
  MountedAngularHost,
} from './angular.types.js';

export {
  AtlasAngularHostAnchors,
  AtlasHostLayout,
  AtlasHostStatus,
  AtlasNavigation,
  AtlasRouteOutlet,
  AtlasSlot,
} from './adapters/angular-anchors.js';
export type {
  AngularHostBootstrapOptions,
  HostOptions,
  HostSdkOptions,
} from './angular.types.js';

@Component({
  selector: 'atlas-default-host-route',
  standalone: true,
  template: '',
})
export class AtlasDefaultHostRouteComponent {}

/** Bootstraps an Angular host and owns the dynamically mounted root lifecycle. */
export async function bootstrapAngularHost<THostSdk extends object = {}>(
  options: AngularHostBootstrapOptions<THostSdk>,
): Promise<MountedAngularHost> {
  const root = options.request
    ? document.createElement('atlas-host-root')
    : undefined;

  if (root && options.request) options.request.container.append(root);

  const sdkReference = new AngularHostSdkReference<THostSdk>();
  const app = await bootstrapApplication(
    options.component,
    appendAtlasSdkProvider(options.appConfig, sdkReference),
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
    ...(hostData ? { hostData: unwrapAngularHostDataSignals(hostData) } : {}),
  } as unknown as DomHostOptions<THostSdk>;
  const runtime = await startDomHost(domHostOptions, {
    beforeNavigation: () => syncAngularRouterWithBrowserUrl(options.router),
    createNavigation: () =>
      createHostNavigation(options.router, options.location),
    ...(services.onSdkCreated ? { onSdkCreated: services.onSdkCreated } : {}),
  });
  const stopHostDataSync =
    hostDataInjector && hostData
      ? syncAngularHostDataSignalsToRuntime({
          hostData,
          runtime,
          injector: hostDataInjector,
        })
      : () => undefined;

  return {
    ...runtime,
    async stop() {
      stopHostDataSync();

      await runtime.stop();
    },
  };
}

class AngularHostSdkReference<THostSdk extends object> {
  private sdk: AtlasSdk<THostSdk> | undefined;

  set(sdk: AtlasSdk<THostSdk>): void {
    this.sdk = sdk;
  }

  get(): AtlasSdk<THostSdk> {
    if (this.sdk) return this.sdk;

    throw new AtlasSdkNotReadyError();
  }
}

function appendAtlasSdkProvider<THostSdk extends object>(
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

  if (router.url !== requestedUrl)
    await router.navigateByUrl(requestedUrl, { replaceUrl: true });
}

function unwrapAngularHostDataSignals<THostSdk extends object>(
  hostData: AngularHostDataInput<THostSdk>,
): AtlasHostDataOf<THostSdk> {
  return Object.fromEntries(
    Object.entries(hostData).map(([key, value]) => [
      key,
      isSignal(value) ? value() : value,
    ]),
  ) as AtlasHostDataOf<THostSdk>;
}

function syncAngularHostDataSignalsToRuntime<THostSdk extends object>(input: {
  hostData: AngularHostDataInput<THostSdk>;
  runtime: AtlasHostRuntime<THostSdk>;
  injector: Injector;
}): () => void {
  const { hostData, runtime, injector } = input;
  const effects = Object.entries(hostData)
    .filter((entry): entry is [string, Signal<unknown>] => isSignal(entry[1]))
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

  return () => effects.forEach((reference) => reference.destroy());
}
