import { Component, Injectable, signal, type OnDestroy, type Signal } from "@angular/core";
import { createHostNavigation, type LocationLike, type RouterLike } from "@atlas/sdk/angular";
import { startDomHost, type DomHostOptions } from "./dom-host.js";
import { readAtlasNavigationItems, subscribeAtlasNavigationItems, type AtlasHostNavigationItem, type AtlasHostRuntime } from "./index.js";

@Component({ selector: "atlas-default-host-route", standalone: true, template: "" })
export class AtlasDefaultHostRouteComponent {}

export interface HostOptions<TExtensions extends object = {}, THostData extends object = {}>
  extends DomHostOptions<TExtensions, THostData> {
  router: RouterLike;
  location: LocationLike;
}

/** Boots Atlas discovery, Native Federation, SDK providers, routes, slots, and lifecycle for an Angular host. */
export async function startHost<TExtensions extends object = {}, THostData extends object = {}>(
  options: HostOptions<TExtensions, THostData>
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
