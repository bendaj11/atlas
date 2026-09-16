import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type {
  AtlasBrowserNavigation,
  AtlasLocation,
} from '../navigation-types/navigation-types.js';
import {
  createBrowserNavigation,
  type BrowserWindowLike,
} from './browser-navigation.js';

type PopstateListener = () => void;

export class BrowserNavigationDriver {
  private readonly origin = faker.internet.url({ appendSlash: false });
  private readonly location = {
    pathname: '/',
    search: '',
    hash: '',
    href: `${this.origin}/`,
  };
  private readonly history = {
    pushState: jest.fn<History['pushState']>(),
    replaceState: jest.fn<History['replaceState']>(),
    back: jest.fn<History['back']>(),
    go: jest.fn<History['go']>(),
  };
  private readonly addEventListener =
    jest.fn<BrowserWindowLike['addEventListener']>();
  private readonly removeEventListener =
    jest.fn<BrowserWindowLike['removeEventListener']>();
  private readonly listener = jest.fn<(location: AtlasLocation) => void>();
  private readonly navigation: AtlasBrowserNavigation = createBrowserNavigation(
    {
      location: this.location,
      history: this.history,
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
    navigated: (
      to: string,
      options?: { replace?: boolean; state?: unknown },
    ): void => {
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
        if (this.isAttached(popstate)) popstate();
      }
    },
  };

  readonly get = {
    navigation: (): AtlasBrowserNavigation => this.navigation,
    listenerMock: (): jest.Mock<(location: AtlasLocation) => void> =>
      this.listener,
    pushStateMock: (): jest.Mock<History['pushState']> =>
      this.history.pushState,
    replaceStateMock: (): jest.Mock<History['replaceState']> =>
      this.history.replaceState,
    goMock: (): jest.Mock<History['go']> => this.history.go,
    backMock: (): jest.Mock<History['back']> => this.history.back,
    addEventListenerMock: (): jest.Mock<
      BrowserWindowLike['addEventListener']
    > => this.addEventListener,
    removeEventListenerMock: (): jest.Mock<
      BrowserWindowLike['removeEventListener']
    > => this.removeEventListener,
    origin: (): string => this.origin,
  };

  private isAttached(popstate: PopstateListener): boolean {
    const added = this.addEventListener.mock.calls.filter(
      ([, listener]) => listener === popstate,
    ).length;
    const removed = this.removeEventListener.mock.calls.filter(
      ([, listener]) => listener === popstate,
    ).length;

    return added > removed;
  }
}
