import type { AtlasNavigation, AtlasScopedNavigation } from "./navigation-types.js";
import { normalizePath, scopePath } from "./navigation-paths.js";

/** Restricts an app's relative and absolute-path navigation to its assigned path. */
export function createScopedNavigation(path: string, navigation: AtlasNavigation): AtlasScopedNavigation {
  const normalizedPath = normalizePath(path);

  return {
    path: normalizedPath,
    navigate(to, options) {
      navigation.navigate(scopePath(normalizedPath, to), options);
    },
    replace(to, options) {
      navigation.replace(scopePath(normalizedPath, to), options);
    },
    back() {
      navigation.back();
    },
    go(delta) {
      if (navigation.go) navigation.go(delta);
      else if (delta === -1) navigation.back();
    },
    createHref(to) {
      return navigation.createHref(scopePath(normalizedPath, to));
    },
    subscribe(listener) {
      return navigation.subscribe(listener);
    },
    getCurrentLocation() {
      return navigation.getCurrentLocation();
    },
    toInnerPath(to) {
      return scopePath(normalizedPath, to);
    }
  };
}
