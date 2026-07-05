export interface AtlasLocation {
  pathname: string;
  search: string;
  hash: string;
}

export interface AtlasNavigateOptions {
  replace?: boolean;
  state?: unknown;
}

export type AtlasNavigationListener = (location: AtlasLocation) => void;

/** Host-owned browser navigation exposed through framework adapters. */
export interface AtlasNavigation {
  navigate(to: string, options?: AtlasNavigateOptions): void;
  replace(to: string, options?: Omit<AtlasNavigateOptions, "replace">): void;
  back(): void;
  /** Moves through host history when the host adapter supports an arbitrary delta. */
  go?(delta: number): void;
  createHref(to: string): string;
  subscribe(listener: AtlasNavigationListener): () => void;
  getCurrentLocation(): AtlasLocation;
}

/** Browser navigation whose global event listener can be explicitly released. */
export interface AtlasBrowserNavigation extends AtlasNavigation {
  dispose(): void;
}

/** MF navigation restricted to the base path assigned by the host catalog. */
export interface AtlasScopedNavigation extends AtlasNavigation {
  readonly basePath: string;
  toInnerPath(to: string): string;
}

export interface AtlasInnerLocation {
  pathname: string;
  query: Readonly<Record<string, string | string[]>>;
  hash: string;
}

export interface AtlasRouteContext {
  readonly basePath: string;
  getCurrent(): AtlasInnerLocation;
  subscribe(listener: (location: AtlasInnerLocation) => void): () => void;
  match(pattern: string): Readonly<Record<string, string>> | undefined;
}

export function createBrowserNavigation(windowLike: Pick<Window, "location" | "history" | "addEventListener" | "removeEventListener"> = window): AtlasBrowserNavigation {
  const listeners = new Set<AtlasNavigationListener>();
  let isListeningToPopstate = false;
  const readLocation = (): AtlasLocation => ({
    pathname: windowLike.location.pathname,
    search: windowLike.location.search,
    hash: windowLike.location.hash
  });
  const notify = () => {
    const location = readLocation();
    for (const listener of listeners) {
      listener(location);
    }
  };
  const popstate = () => notify();
  const attachPopstate = () => {
    if (isListeningToPopstate) return;
    windowLike.addEventListener("popstate", popstate);
    isListeningToPopstate = true;
  };
  const detachPopstate = () => {
    if (!isListeningToPopstate) return;
    windowLike.removeEventListener("popstate", popstate);
    isListeningToPopstate = false;
  };

  return {
    navigate(to, options) {
      if (options?.replace) {
        windowLike.history.replaceState(options.state ?? null, "", to);
      } else {
        windowLike.history.pushState(options?.state ?? null, "", to);
      }
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

/** Restricts an MF's relative and absolute-path navigation to its assigned base path. */
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

export function createRouteContext(basePath: string, navigation: AtlasNavigation): AtlasRouteContext {
  const normalized = normalizeBasePath(basePath);
  const read = (location = navigation.getCurrentLocation()): AtlasInnerLocation => ({
    pathname: toInnerPath(normalized, location.pathname),
    query: parseQuery(location.search),
    hash: location.hash
  });
  return {
    basePath: normalized,
    getCurrent: read,
    subscribe(listener) { return navigation.subscribe((location) => listener(read(location))); },
    match(pattern) { return matchRoutePattern(pattern, read().pathname); }
  };
}

export function scopePath(basePath: string, to: string): string {
  const normalizedBasePath = normalizeBasePath(basePath);
  if (/^https?:\/\//.test(to)) {
    throw new Error("Atlas scoped navigation only accepts same-origin paths.");
  }

  if (to.startsWith(normalizedBasePath)) {
    return to;
  }

  const child = to.startsWith("/") ? to.slice(1) : to;
  return child.length === 0 ? normalizedBasePath : `${normalizedBasePath}/${child}`;
}

export function normalizeBasePath(basePath: string): string {
  if (!basePath.startsWith("/")) {
    return `/${basePath}`.replace(/\/+$/, "");
  }

  return basePath.replace(/\/+$/, "") || "/";
}

function toInnerPath(basePath: string, pathname: string): string {
  if (basePath === "/") return pathname || "/";
  if (pathname === basePath) return "/";
  return pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length) : "/";
}

function parseQuery(search: string): Readonly<Record<string, string | string[]>> {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of new URLSearchParams(search)) {
    const current = result[key];
    result[key] = current === undefined ? value : Array.isArray(current) ? [...current, value] : [current, value];
  }
  return result;
}

function matchRoutePattern(pattern: string, pathname: string): Readonly<Record<string, string>> | undefined {
  const patternParts = pattern.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const pathParts = pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const params: Record<string, string> = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index]!;
    if (expected === "*") {
      params.wildcard = decodeURIComponent(pathParts.slice(index).join("/"));
      return params;
    }
    const actual = pathParts[index];
    if (actual === undefined) return undefined;
    if (expected.startsWith(":")) params[expected.slice(1)] = decodeURIComponent(actual);
    else if (expected !== actual) return undefined;
  }
  return patternParts.length === pathParts.length ? params : undefined;
}
