import type { AtlasMfContext } from "./lifecycle.js";
import type { LocationStrategyAdapter } from "./angular-types.js";

type PopStateListener = (event: { type: "popstate"; state: unknown }) => void;

/** Creates the LocationStrategy used by an Angular Router mounted inside an Atlas MF. */
export function createLocationStrategy(context: AtlasMfContext): LocationStrategyAdapter {
  const listeners = new Set<PopStateListener>();
  let ignoredUrl: string | undefined;

  const stop = context.route.subscribe(() => {
    const current = readInnerUrl(context);
    if (ignoredUrl === current) {
      ignoredUrl = undefined;
      return;
    }
    notifyPopState(listeners);
  });

  return {
    path(includeHash = true) {
      return readInnerUrl(context, includeHash);
    },
    prepareExternalUrl(internal) {
      return context.navigation.toInnerPath(internal);
    },
    getState() {
      return undefined;
    },
    pushState(state, _title, url, query) {
      ignoredUrl = targetUrl(url, query);
      context.navigation.navigate(ignoredUrl, { state });
    },
    replaceState(state, _title, url, query) {
      ignoredUrl = targetUrl(url, query);
      context.navigation.replace(ignoredUrl, { state });
    },
    forward() {
      context.navigation.go?.(1);
    },
    back() {
      context.navigation.back();
    },
    historyGo(delta) {
      if (context.navigation.go) context.navigation.go(delta);
      else if (delta === -1) context.navigation.back();
    },
    onPopState(listener) {
      listeners.add(listener);
    },
    getBaseHref() {
      return "/";
    },
    ngOnDestroy() {
      stop();
      listeners.clear();
    }
  };
}

function readInnerUrl(context: AtlasMfContext, includeHash = true): string {
  const route = context.route.getCurrent();
  const host = context.navigation.getCurrentLocation();
  return `${route.pathname}${host.search}${includeHash ? host.hash : ""}`;
}

function targetUrl(url: string, query: string): string {
  return `${url.startsWith("/") ? url : `/${url}`}${query || ""}`;
}

function notifyPopState(listeners: Set<PopStateListener>): void {
  for (const listener of listeners) {
    listener({ type: "popstate", state: undefined });
  }
}
