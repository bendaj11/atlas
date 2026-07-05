import { inject, InjectionToken, type Provider } from "@angular/core";
import type { AtlasExportedComponentEntry, AtlasExportedComponentMountRequest, AtlasMfContext, AtlasMfEntry, AtlasMfMountRequest, AtlasMfMountResult } from "./lifecycle.js";
import type { AtlasSdk as AtlasSdkValue } from "./host.js";
import type { AtlasLocation, AtlasNavigation } from "./navigation.js";

export interface MicrofrontendBootstrap {
  (request: AtlasMfMountRequest): void | AtlasMfMountResult | Promise<void | AtlasMfMountResult>;
}

const ATLAS_SDK = new InjectionToken<AtlasSdkValue>("AtlasSdk");

export type AtlasSdk<TExtensions extends object = {}> = AtlasSdkValue<TExtensions>;

export function provideAtlasSdk<TExtensions extends object>(sdk: AtlasSdk<TExtensions>): Provider {
  return { provide: ATLAS_SDK, useValue: sdk };
}

export function injectAtlasSdk<TExtensions extends object = {}>(): AtlasSdk<TExtensions> {
  return inject(ATLAS_SDK) as AtlasSdk<TExtensions>;
}

export function defineMicrofrontend(bootstrap: MicrofrontendBootstrap): AtlasMfEntry {
  return {
    mount(request) {
      return bootstrap(request);
    }
  };
}

export function defineExportedComponent<TProps extends object>(
  bootstrap: (request: AtlasExportedComponentMountRequest<TProps>) => void | AtlasMfMountResult | Promise<void | AtlasMfMountResult>
): AtlasExportedComponentEntry<TProps> {
  return { mount: bootstrap };
}

export interface RouterLike {
  readonly url: string;
  navigateByUrl(url: string, options?: { replaceUrl?: boolean; state?: unknown }): Promise<boolean>;
  events: { subscribe(listener: () => void): { unsubscribe(): void } };
}

export interface LocationLike {
  back(): void;
  historyGo?(delta: number): void;
}

export interface LocationStrategyAdapter {
  path(includeHash?: boolean): string;
  prepareExternalUrl(internal: string): string;
  getState(): unknown;
  pushState(state: unknown, title: string, url: string, queryParams: string): void;
  replaceState(state: unknown, title: string, url: string, queryParams: string): void;
  forward(): void;
  back(): void;
  historyGo(relativePosition: number): void;
  onPopState(listener: (event: { type: "popstate"; state: unknown }) => void): void;
  getBaseHref(): string;
  ngOnDestroy(): void;
}

/** Creates the LocationStrategy used by an Angular Router mounted inside an Atlas MF. */
export function createLocationStrategy(context: AtlasMfContext): LocationStrategyAdapter {
  const listeners = new Set<(event: { type: "popstate"; state: unknown }) => void>();
  let ignoredUrl: string | undefined;
  const innerUrl = (includeHash = true) => {
    const route = context.route.getCurrent();
    const host = context.navigation.getCurrentLocation();
    return `${route.pathname}${host.search}${includeHash ? host.hash : ""}`;
  };
  const stop = context.route.subscribe(() => {
    const current = innerUrl();
    if (ignoredUrl === current) {
      ignoredUrl = undefined;
      return;
    }
    for (const listener of listeners) listener({ type: "popstate", state: undefined });
  });
  const target = (url: string, query: string) => `${url.startsWith("/") ? url : `/${url}`}${query || ""}`;

  return {
    path: innerUrl,
    prepareExternalUrl(internal) { return context.navigation.toInnerPath(internal); },
    getState() { return undefined; },
    pushState(state, _title, url, query) {
      ignoredUrl = target(url, query);
      context.navigation.navigate(ignoredUrl, { state });
    },
    replaceState(state, _title, url, query) {
      ignoredUrl = target(url, query);
      context.navigation.replace(ignoredUrl, { state });
    },
    forward() { context.navigation.go?.(1); },
    back() { context.navigation.back(); },
    historyGo(delta) { if (context.navigation.go) context.navigation.go(delta); else if (delta === -1) context.navigation.back(); },
    onPopState(listener) { listeners.add(listener); },
    getBaseHref() { return "/"; },
    ngOnDestroy() { stop(); listeners.clear(); }
  };
}

export function createHostNavigation(
  router: RouterLike,
  location: LocationLike,
  origin = typeof window === "undefined" ? "http://localhost" : window.location.origin
): AtlasNavigation {
  const read = (): AtlasLocation => {
    const url = new URL(router.url, origin);
    return { pathname: url.pathname, search: url.search, hash: url.hash };
  };
  return {
    navigate(to, options) { void router.navigateByUrl(to, options?.replace ? { replaceUrl: true, state: options.state } : { state: options?.state }); },
    replace(to, options) { void router.navigateByUrl(to, { replaceUrl: true, state: options?.state }); },
    back() { location.back(); },
    go(delta) { if (location.historyGo) location.historyGo(delta); else if (delta === -1) location.back(); },
    createHref(to) { return new URL(to, origin).toString(); },
    subscribe(listener) {
      listener(read());
      const subscription = router.events.subscribe(() => listener(read()));
      return () => subscription.unsubscribe();
    },
    getCurrentLocation: read
  };
}
