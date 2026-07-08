import type { AtlasNavigation, AtlasScopedNavigation } from "./navigation-types.js";
import { normalizeBasePath, scopePath } from "./navigation-paths.js";

/** Restricts an app's relative and absolute-path navigation to its assigned base path. */
export function createScopedNavigation(basePath: string, navigation: AtlasNavigation): AtlasScopedNavigation {
  const normalizedBasePath = normalizeBasePath(basePath);

  return {
    basePath: normalizedBasePath,
    navigate(to, options) {
      navigation.navigate(scopePath(normalizedBasePath, to), options);
    },
    replace(to, options) {
      navigation.replace(scopePath(normalizedBasePath, to), options);
    },
    back() {
      navigation.back();
    },
    go(delta) {
      if (navigation.go) navigation.go(delta);
      else if (delta === -1) navigation.back();
    },
    createHref(to) {
      return navigation.createHref(scopePath(normalizedBasePath, to));
    },
    subscribe(listener) {
      return navigation.subscribe(listener);
    },
    getCurrentLocation() {
      return navigation.getCurrentLocation();
    },
    toInnerPath(to) {
      return scopePath(normalizedBasePath, to);
    }
  };
}
