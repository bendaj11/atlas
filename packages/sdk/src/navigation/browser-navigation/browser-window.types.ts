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

export interface BrowserHistoryLike {
  pushState: WriteHistoryEntry;
  replaceState: WriteHistoryEntry;
  back: HistoryBack;
  go: HistoryGo;
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
  addEventListener: BrowserPopstateRegistrar;
  removeEventListener: BrowserPopstateRegistrar;
}
