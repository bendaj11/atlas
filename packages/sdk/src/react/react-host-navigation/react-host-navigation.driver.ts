import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type {
  AtlasLocation,
  AtlasNavigation,
  AtlasUnsubscribe,
} from '../../navigation/navigation-types/navigation-types.js';
import { parseUrlIntoLocation } from '../../testkit/navigation.testkit.js';
import type { RouterLike, RouterNavigate } from '../react-router/index.js';
import { createHostNavigation } from './react-host-navigation.js';

export class ReactHostNavigationDriver {
  private readonly origin = faker.internet.url({ appendSlash: false });
  private readonly subscribers = new Set<() => void>();
  private readonly listener = jest.fn<(location: AtlasLocation) => void>();
  private readonly navigate = jest.fn<RouterNavigate>((to) => {
    if (typeof to === 'string')
      this.router.state.location = parseUrlIntoLocation(to);

    for (const subscriber of this.subscribers) subscriber();
  });
  private readonly router: RouterLike = {
    state: { location: parseUrlIntoLocation('/') },
    navigate: this.navigate,
    subscribe: (subscriber) => {
      this.subscribers.add(subscriber);

      return () => this.subscribers.delete(subscriber);
    },
  };
  private navigation!: AtlasNavigation;
  private unsubscribe!: AtlasUnsubscribe;

  readonly given = {
    routerUrl: (url: string): this => {
      this.router.state.location = parseUrlIntoLocation(url);

      return this;
    },
    routerPathnameOnly: (pathname: string): this => {
      this.router.state.location = { pathname };

      return this;
    },
  };

  readonly when = {
    created: (): void => {
      this.navigation = createHostNavigation(this.router, this.origin);
    },
    createdWithDefaultOrigin: (): void => {
      this.navigation = createHostNavigation(this.router);
    },
    subscribed: (): void => {
      this.unsubscribe = this.navigation.subscribe(this.listener);
    },
    unsubscribed: (): void => {
      this.unsubscribe();
    },
    navigated: (to: string): void => {
      this.navigation.navigate(to);
    },
    navigatedWithState: (to: string, state: unknown): void => {
      this.navigation.navigate(to, { state });
    },
    navigatedWithReplace: (to: string, replace: boolean): void => {
      this.navigation.navigate(to, { replace });
    },
    replaced: (to: string): void => {
      this.navigation.replace(to);
    },
    replacedWithState: (to: string, state: unknown): void => {
      this.navigation.replace(to, { state });
    },
    wentBack: (): void => {
      this.navigation.back();
    },
    wentThroughHistory: (delta: number): void => {
      this.navigation.go?.(delta);
    },
  };

  readonly get = {
    navigation: (): AtlasNavigation => this.navigation,
    navigateMock: (): jest.Mock<RouterNavigate> => this.navigate,
    listenerMock: () => this.listener,
    origin: (): string => this.origin,
    subscriberCount: (): number => this.subscribers.size,
  };
}
