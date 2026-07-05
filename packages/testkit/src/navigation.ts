import type { AtlasLocation, AtlasNavigateOptions, AtlasNavigation, AtlasNavigationListener } from "@atlas/sdk/navigation";

export function createMemoryNavigation(initialPath = "/"): AtlasNavigation {
  let location: AtlasLocation = splitPath(initialPath);
  const listeners = new Set<AtlasNavigationListener>();

  const notify = () => {
    for (const listener of listeners) {
      listener(location);
    }
  };

  return {
    navigate(to: string, _options?: AtlasNavigateOptions) {
      location = splitPath(to);
      notify();
    },
    replace(to: string) {
      location = splitPath(to);
      notify();
    },
    back() {
      return undefined;
    },
    createHref(to: string) {
      return to;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(location);
      return () => listeners.delete(listener);
    },
    getCurrentLocation() {
      return location;
    }
  };
}

function splitPath(value: string): AtlasLocation {
  const url = new URL(value, "http://atlas.local");
  return {
    pathname: url.pathname,
    search: url.search,
    hash: url.hash
  };
}
