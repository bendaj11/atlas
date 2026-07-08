import { Component } from "@angular/core";
import { createHostNavigation, type LocationLike, type RouterLike } from "@atlas/sdk/angular";
import { startDomHost, type DomHostOptions } from "./dom-host.js";
import type { AtlasHostRuntime } from "./index.js";

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

async function syncAngularRouterWithBrowserUrl(router: RouterLike): Promise<void> {
  const browserLocation = globalThis.location;
  if (!browserLocation) return;

  const requestedUrl = `${browserLocation.pathname}${browserLocation.search}${browserLocation.hash}`;
  if (router.url !== requestedUrl) {
    await router.navigateByUrl(requestedUrl, { replaceUrl: true });
  }
}
