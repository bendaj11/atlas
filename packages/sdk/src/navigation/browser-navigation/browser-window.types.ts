export interface BrowserLocationLike {
  pathname: string;
  search: string;
  hash: string;
  href: string;
}

export type WriteHistoryEntry = (
  state: unknown,
  unused: string,
  url?: string | URL | null,
) => void;

export type HistoryBack = () => void;

export type HistoryGo = (delta?: number) => void;

/** The `History` members Atlas drives; the real `window.history` is assignable. */
export interface BrowserHistoryLike {
  pushState(state: unknown, unused: string, url?: string | URL | null): void;
  replaceState(state: unknown, unused: string, url?: string | URL | null): void;
  back(): void;
  go(delta?: number): void;
}

export type BrowserPopstateListener = () => void;

export type BrowserPopstateRegistrar = (
  type: 'popstate',
  listener: BrowserPopstateListener,
) => void;

/** The `window` surface the browser navigation adapter needs; injectable for tests. */
export interface BrowserWindowLike {
  location: BrowserLocationLike;
  history: BrowserHistoryLike;
  addEventListener(type: 'popstate', listener: BrowserPopstateListener): void;
  removeEventListener(
    type: 'popstate',
    listener: BrowserPopstateListener,
  ): void;
}
