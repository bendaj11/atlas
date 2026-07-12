import { Component, Injectable, signal, type OnDestroy, type Signal } from "@angular/core";
import { createHostNavigation, type LocationLike, type RouterLike } from "@atlas/sdk/angular";
import { startDomHost, type DomHostOptions } from "./dom-host.js";
import { readAtlasNavigationItems, subscribeAtlasNavigationItems, type AtlasHostNavigationItem, type AtlasHostRuntime } from "./index.js";

@Component({ selector: "atlas-default-host-route", standalone: true, template: "" })
export class AtlasDefaultHostRouteComponent {}

export type HostOptions<THostSdk extends object = {}> = DomHostOptions<THostSdk> & {
  router: RouterLike;
  location: LocationLike;
};

/** Boots Atlas discovery, Native Federation, SDK providers, routes, slots, and lifecycle for an Angular host. */
export async function startHost<THostSdk extends object = {}>(
  options: HostOptions<THostSdk>
): Promise<AtlasHostRuntime> {
  return startDomHost(options, {
    beforeNavigation: () => syncAngularRouterWithBrowserUrl(options.router),
    createNavigation: () => createHostNavigation(options.router, options.location)
  });
}

@Injectable({ providedIn: "root" })
export class AtlasNavigationItemsService implements OnDestroy {
  private readonly itemsState = signal<readonly AtlasHostNavigationItem[]>(readAtlasNavigationItems());
  private readonly unsubscribe = subscribeAtlasNavigationItems((items) => this.itemsState.set(items));

  readonly items: Signal<readonly AtlasHostNavigationItem[]> = this.itemsState.asReadonly();

  ngOnDestroy(): void {
    this.unsubscribe();
  }
}

async function syncAngularRouterWithBrowserUrl(router: RouterLike): Promise<void> {
  const browserLocation = globalThis.location;
  if (!browserLocation) return;

  const requestedUrl = `${browserLocation.pathname}${browserLocation.search}${browserLocation.hash}`;
  if (router.url !== requestedUrl) {
    await router.navigateByUrl(requestedUrl, { replaceUrl: true });
  }
}
