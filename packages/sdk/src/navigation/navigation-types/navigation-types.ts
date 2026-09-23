export interface AtlasLocation {
  pathname: string;
  search: string;
  hash: string;
}

export interface AtlasNavigateOptions {
  replace?: boolean;
  state?: unknown;
}

export type AtlasReplaceOptions = Omit<AtlasNavigateOptions, 'replace'>;

export type AtlasNavigationListener = (location: AtlasLocation) => void;

export type AtlasUnsubscribe = () => void;

export type NavigateToPath = (
  to: string,
  options?: AtlasNavigateOptions,
) => void;

export type ReplacePath = (to: string, options?: AtlasReplaceOptions) => void;

export type GoBack = () => void;

export type GoThroughHistory = (delta: number) => void;

export type CreateHref = (to: string) => string;

export type SubscribeToLocation = (
  listener: AtlasNavigationListener,
) => AtlasUnsubscribe;

export type ReadLocation = () => AtlasLocation;

/**
 * Host-owned browser navigation exposed through framework adapters.
 * Members stay method-style so host adapters written against a wider option type stay assignable.
 */
export interface AtlasNavigation {
  navigate(to: string, options?: AtlasNavigateOptions): void;
  replace(to: string, options?: AtlasReplaceOptions): void;
  back(): void;
  /** Moves through host history when the host adapter supports an arbitrary delta. */
  go?(delta: number): void;
  createHref(to: string): string;
  subscribe(listener: AtlasNavigationListener): AtlasUnsubscribe;
  getCurrentLocation(): AtlasLocation;
}

/** Browser navigation whose global event listener can be explicitly released. */
export interface AtlasBrowserNavigation extends AtlasNavigation {
  dispose(): void;
}

/** App navigation restricted to the path assigned by the host catalog. */
export interface AtlasScopedNavigation extends AtlasNavigation {
  readonly path: string;
  /** Maps an app-relative path to the host path it navigates to. */
  toHostPath(to: string): string;
}

export type AtlasQueryValues = Readonly<Record<string, string | string[]>>;

export type AtlasRouteParams = Readonly<Record<string, string>>;

export interface AtlasInnerLocation {
  pathname: string;
  query: AtlasQueryValues;
  hash: string;
}

export type AtlasInnerLocationListener = (location: AtlasInnerLocation) => void;

export interface AtlasRouteContext {
  readonly path: string;
  getCurrent(): AtlasInnerLocation;
  setTabTitle(title: string): void;
  subscribe(listener: AtlasInnerLocationListener): AtlasUnsubscribe;
  match(pattern: string): AtlasRouteParams | undefined;
}
