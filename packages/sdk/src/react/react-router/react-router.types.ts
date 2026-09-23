export interface RouterLocation {
  pathname: string;
  search?: string;
  hash?: string;
}

export interface RouterState {
  location: RouterLocation;
  historyAction?: string;
}

export interface RouterNavigateOptions {
  replace?: boolean;
  state?: unknown;
}

/** Path navigation or a history delta, as React Router's `router.navigate` accepts. */
export type RouterNavigate = (
  to: string | number,
  options?: RouterNavigateOptions,
) => Promise<void> | void;

export type RouterSubscribe = (listener: () => void) => () => void;

/**
 * The subset of a React Router data router that Atlas reads and drives.
 * Members stay method-style so a router created by any React Router version is assignable.
 */
export interface RouterLike {
  readonly state: RouterState;
  navigate(
    to: string | number,
    options?: RouterNavigateOptions,
  ): Promise<void> | void;
  subscribe(listener: () => void): () => void;
}

/** An app memory router; `dispose` is called when the app unmounts. */
export interface AppRouterLike extends RouterLike {
  dispose?(): void;
}
