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
