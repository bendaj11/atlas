import type { AtlasInnerLocation, AtlasNavigation, AtlasRouteContext } from "./navigation-types.js";
import { matchRoutePattern, normalizeBasePath, parseQuery, toInnerPath } from "./navigation-paths.js";

export interface AtlasRouteContextOptions {
  setTabTitle?: (title: string) => void;
}

export function createRouteContext(basePath: string, navigation: AtlasNavigation, options: AtlasRouteContextOptions = {}): AtlasRouteContext {
  const normalizedBasePath = normalizeBasePath(basePath);

  const read = (location = navigation.getCurrentLocation()): AtlasInnerLocation => ({
    pathname: toInnerPath(normalizedBasePath, location.pathname),
    query: parseQuery(location.search),
    hash: location.hash
  });

  return {
    basePath: normalizedBasePath,
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
