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
    subscribed: (): void => {
      this.unsubscribe = this.navigation.subscribe(this.listener);
    },
    unsubscribed: (): void => {
      this.unsubscribe?.();
    },
    disposed: (): void => {
      this.navigation.dispose();
    },
    navigated: (to: string, options?: AtlasNavigateOptions): void => {
      this.navigation.navigate(to, options);
    },
    replaced: (to: string): void => {
      this.navigation.replace(to);
    },
    historyMoved: (delta: number): void => {
      this.navigation.go?.(delta);
    },
    browserMovedTo: (pathname: string): void => {
      this.location.pathname = pathname;
      this.location.href = `${this.origin}${pathname}`;

      for (const [, popstate] of this.addEventListener.mock.calls) {
        if (this.isPopstateAttached(popstate)) popstate();
      }
    },
  };

  readonly get = {
    navigation: (): AtlasBrowserNavigation => this.navigation,
    listenerMock: (): jest.Mock<AtlasNavigationListener> => this.listener,
    pushStateMock: (): jest.Mock<WriteHistoryEntry> => this.pushState,
    replaceStateMock: (): jest.Mock<WriteHistoryEntry> => this.replaceState,
    goMock: (): jest.Mock<HistoryGo> => this.go,
    backMock: (): jest.Mock<HistoryBack> => this.back,
    addEventListenerMock: (): jest.Mock<BrowserPopstateRegistrar> =>
      this.addEventListener,
    removeEventListenerMock: (): jest.Mock<BrowserPopstateRegistrar> =>
      this.removeEventListener,
    origin: (): string => this.origin,
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
