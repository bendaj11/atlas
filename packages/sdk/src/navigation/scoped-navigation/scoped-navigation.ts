import type {
  AtlasNavigation,
  AtlasScopedNavigation,
} from '../navigation-types/navigation-types.js';
import {
  goThroughHistory,
  normalizePath,
  scopeAppPathToHost,
} from '../navigation-paths/index.js';

/** Restricts an app's relative and absolute-path navigation to its assigned path. */
export function createScopedNavigation(
  path: string,
  navigation: AtlasNavigation,
): AtlasScopedNavigation {
  const normalizedPath = normalizePath(path);

  return {
    path: normalizedPath,
    navigate(to, options) {
      navigation.navigate(scopeAppPathToHost(normalizedPath, to), options);
    },

    replace(to, options) {
      navigation.replace(scopeAppPathToHost(normalizedPath, to), options);
    },

    back() {
      navigation.back();
    },

    go(delta) {
      goThroughHistory(navigation, delta);
    },

    createHref(to) {
      return navigation.createHref(scopeAppPathToHost(normalizedPath, to));
    },

    subscribe(listener) {
      return navigation.subscribe(listener);
    },

    getCurrentLocation() {
      return navigation.getCurrentLocation();
    },

    toHostPath(to) {
      return scopeAppPathToHost(normalizedPath, to);
    },
  };
}
