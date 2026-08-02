import {
  Component,
  Injectable,
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
  type LocationLike,
  type RouterLike,
} from '@atlas/sdk/angular';
import type { AtlasHostClientEntry } from '@atlas/sdk/lifecycle';
import { startDomHost, type DomHostOptions } from './dom-host.js';
import {
  readAtlasNavigationItems,
  subscribeAtlasNavigationItems,
  type AtlasHostNavigationItem,
  type AtlasHostRuntime,
} from './index.js';
export {
  AtlasAngularHostAnchors,
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

export type HostOptions<THostSdk extends object = {}> =
  DomHostOptions<THostSdk> & {
    router: RouterLike;
    location: LocationLike;
  };

type HostMountRequest = Parameters<AtlasHostClientEntry['mount']>[0];

export interface AngularHostBootstrapOptions<THostSdk extends object = {}> {
  component: Type<unknown>;
  appConfig: ApplicationConfig;
  request?: HostMountRequest;
  createHostOptions(injector: Injector): HostOptions<THostSdk>;
}

/** Bootstraps an Angular host and owns the dynamically mounted root lifecycle. */
export async function bootstrapAngularHost<THostSdk extends object = {}>(
  options: AngularHostBootstrapOptions<THostSdk>,
): Promise<{ unmount(): Promise<void> }> {
  const root = options.request
    ? document.createElement('atlas-host-root')
    : undefined;
  if (root && options.request) options.request.container.append(root);

  const app = await bootstrapApplication(options.component, options.appConfig);
  const runtime = await startHost(options.createHostOptions(app.injector));

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
): Promise<AtlasHostRuntime> {
  return startDomHost(options, {
    beforeNavigation: () => syncAngularRouterWithBrowserUrl(options.router),
    createNavigation: () =>
      createHostNavigation(options.router, options.location),
  });
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
