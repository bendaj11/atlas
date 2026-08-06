import type { AtlasInnerLocation, AtlasNavigation, AtlasRouteContext } from "./navigation-types.js";
import { matchRoutePattern, normalizePath, parseQuery, toInnerPath } from "./navigation-paths.js";

export interface AtlasRouteContextOptions {
  setTabTitle?: (title: string) => void;
}

export function createRouteContext(path: string, navigation: AtlasNavigation, options: AtlasRouteContextOptions = {}): AtlasRouteContext {
  const normalizedPath = normalizePath(path);

  const read = (location = navigation.getCurrentLocation()): AtlasInnerLocation => ({
    pathname: toInnerPath(normalizedPath, location.pathname),
    query: parseQuery(location.search),
    hash: location.hash
  });

  return {
    path: normalizedPath,
    getCurrent: read,
    setTabTitle(title) {
      options.setTabTitle?.(title);
    },
    subscribe(listener) {
      return navigation.subscribe((location) => listener(read(location)));
    },
    match(pattern) {
      return matchRoutePattern(pattern, read().pathname);
    }
  };
}
