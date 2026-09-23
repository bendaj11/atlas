export interface AngularNavigateByUrlOptions {
  replaceUrl?: boolean;
  state?: unknown;
}

export type NavigateByUrl = (
  url: string,
  options?: AngularNavigateByUrlOptions,
) => Promise<boolean>;

export interface RouterEventSubscription {
  unsubscribe(): void;
}

export interface RouterEvents {
  subscribe(listener: () => void): RouterEventSubscription;
}

/**
 * The subset of Angular `Router` the host navigation adapter reads and drives.
 * Members stay method-style so the real `Router` stays assignable.
 */
export interface RouterLike {
  readonly url: string;
  navigateByUrl(
    url: string,
    options?: AngularNavigateByUrlOptions,
  ): Promise<boolean>;
  events: RouterEvents;
}

export type LocationBack = () => void;

export type LocationHistoryGo = (delta: number) => void;

/** The subset of Angular `Location` the host navigation adapter uses for history moves. */
export interface LocationLike {
  back(): void;
  historyGo?(delta: number): void;
}

export interface PopStateEvent {
  readonly type: 'popstate';
  readonly state: unknown;
}

export type PopStateListener = (event: PopStateEvent) => void;

export type WriteLocationState = (
  state: unknown,
  title: string,
  url: string,
  queryParams: string,
) => void;

/** The Angular `LocationStrategy` surface an app router needs from Atlas. */
export interface LocationStrategyAdapter {
  path(includeHash?: boolean): string;
  prepareExternalUrl(internal: string): string;
  getState(): unknown;
  pushState(
    state: unknown,
    title: string,
    url: string,
    queryParams: string,
  ): void;
  replaceState(
    state: unknown,
    title: string,
    url: string,
    queryParams: string,
  ): void;
  forward(): void;
  back(): void;
  historyGo(relativePosition: number): void;
  onPopState(listener: PopStateListener): void;
  getBaseHref(): string;
  ngOnDestroy(): void;
}
