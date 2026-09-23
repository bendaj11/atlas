import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type {
  AtlasBrowserNavigation,
  AtlasNavigateOptions,
  AtlasNavigationListener,
} from '../navigation-types/navigation-types.js';
import { createBrowserNavigation } from './browser-navigation.js';
import type {
  BrowserLocationLike,
  HistoryBack,
  HistoryGo,
  BrowserPopstateListener,
  BrowserPopstateRegistrar,
  WriteHistoryEntry,
} from './browser-window.types.js';

export class BrowserNavigationDriver {
  private readonly origin = faker.internet.url({ appendSlash: false });
  private readonly location: BrowserLocationLike = {
    pathname: '/',
    search: '',
    hash: '',
    href: `${this.origin}/`,
  };
  private readonly pushState = jest.fn<WriteHistoryEntry>();
  private readonly replaceState = jest.fn<WriteHistoryEntry>();
  private readonly back = jest.fn<HistoryBack>();
  private readonly go = jest.fn<HistoryGo>();
  private readonly addEventListener = jest.fn<BrowserPopstateRegistrar>();
  private readonly removeEventListener = jest.fn<BrowserPopstateRegistrar>();
  private readonly listener = jest.fn<AtlasNavigationListener>();
  private readonly navigation: AtlasBrowserNavigation = createBrowserNavigation(
    {
      location: this.location,
      history: {
        pushState: this.pushState,
        replaceState: this.replaceState,
        back: this.back,
        go: this.go,
      },
      addEventListener: this.addEventListener,
      removeEventListener: this.removeEventListener,
    },
  );
  private unsubscribe: (() => void) | undefined;

  readonly when = {
    subscribed: () => {
      this.unsubscribe = this.navigation.subscribe(this.listener);
    },
    unsubscribed: () => {
      this.unsubscribe?.();
    },
    disposed: () => {
      this.navigation.dispose();
    },
    navigated: (to: string, options?: AtlasNavigateOptions) => {
      this.navigation.navigate(to, options);
    },
    replaced: (to: string) => {
      this.navigation.replace(to);
    },
    historyMoved: (delta: number) => {
      this.navigation.go?.(delta);
    },
    browserMovedTo: (pathname: string) => {
      this.location.pathname = pathname;
      this.location.href = `${this.origin}${pathname}`;

      for (const [, popstate] of this.addEventListener.mock.calls) {
        if (this.isPopstateAttached(popstate)) popstate();
      }
    },
  };

  readonly get = {
    navigation: () => this.navigation,
    listenerMock: () => this.listener,
    pushStateMock: () => this.pushState,
    replaceStateMock: () => this.replaceState,
    goMock: () => this.go,
    backMock: () => this.back,
    addEventListenerMock: () => this.addEventListener,
    removeEventListenerMock: () => this.removeEventListener,
    origin: () => this.origin,
  };

  private isPopstateAttached(popstate: BrowserPopstateListener): boolean {
    const added = this.addEventListener.mock.calls.filter(
      ([, listener]) => listener === popstate,
    ).length;
    const removed = this.removeEventListener.mock.calls.filter(
      ([, listener]) => listener === popstate,
    ).length;

    return added > removed;
  }
}
