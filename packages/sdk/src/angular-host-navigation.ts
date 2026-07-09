import type { AtlasLocation, AtlasNavigation } from "./navigation.js";
import type { LocationLike, RouterLike } from "./angular-types.js";

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
    navigate(to, options) {
      void router.navigateByUrl(to, navigateOptions(options));
    },
    replace(to, options) {
      void router.navigateByUrl(to, navigateOptions({ ...options, replace: true }));
    },
    back() {
      location.back();
    },
    go(delta) {
      if (location.historyGo) location.historyGo(delta);
      else if (delta === -1) location.back();
    },
    createHref(to) {
      return new URL(to, origin).toString();
    },
    subscribe(listener) {
      let previous = read();
      listener(previous);
      const subscription = router.events.subscribe(() => {
        const next = read();
        if (sameLocation(previous, next)) return;
        previous = next;
        listener(next);
      });
      return () => subscription.unsubscribe();
    },
    getCurrentLocation: read
  };
}

function sameLocation(left: AtlasLocation, right: AtlasLocation): boolean {
  return left.pathname === right.pathname && left.search === right.search && left.hash === right.hash;
}

function navigateOptions(options: { replace?: boolean; state?: unknown } | undefined): { replaceUrl?: boolean; state?: unknown } {
  return {
    ...(options?.replace ? { replaceUrl: true } : {}),
    ...(options?.state !== undefined ? { state: options.state } : {})
  };
}
