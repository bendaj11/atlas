import type { AtlasBrowserNavigation, AtlasLocation, AtlasNavigationListener } from "./navigation-types.js";

export interface BrowserWindowLike {
  location: Pick<Location, "pathname" | "search" | "hash" | "href">;
  history: Pick<History, "pushState" | "replaceState" | "back" | "go">;
  addEventListener(type: "popstate", listener: () => void): void;
  removeEventListener(type: "popstate", listener: () => void): void;
}

export function createBrowserNavigation(windowLike: BrowserWindowLike = window): AtlasBrowserNavigation {
  const listeners = new Set<AtlasNavigationListener>();
  let isListeningToPopstate = false;

  const readLocation = (): AtlasLocation => ({
    pathname: windowLike.location.pathname,
    search: windowLike.location.search,
    hash: windowLike.location.hash
  });

  const notify = (): void => {
    const location = readLocation();
    for (const listener of listeners) listener(location);
  };

  const popstate = (): void => notify();

  const attachPopstate = (): void => {
    if (isListeningToPopstate) return;
    windowLike.addEventListener("popstate", popstate);
    isListeningToPopstate = true;
  };

  const detachPopstate = (): void => {
    if (!isListeningToPopstate) return;
    windowLike.removeEventListener("popstate", popstate);
    isListeningToPopstate = false;
  };

  return {
    navigate(to, options) {
      const method = options?.replace ? "replaceState" : "pushState";
      windowLike.history[method](options?.state ?? null, "", to);
      notify();
    },
    replace(to, options) {
      windowLike.history.replaceState(options?.state ?? null, "", to);
      notify();
    },
    back() {
      windowLike.history.back();
    },
    go(delta) {
      windowLike.history.go(delta);
    },
    createHref(to) {
      return new URL(to, windowLike.location.href).toString();
    },
    subscribe(listener) {
      attachPopstate();
      listeners.add(listener);
      listener(readLocation());
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) detachPopstate();
      };
    },
    getCurrentLocation: readLocation,
    dispose() {
      listeners.clear();
      detachPopstate();
    }
  };
}
