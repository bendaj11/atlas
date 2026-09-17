import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type {
  AtlasLocation,
  AtlasNavigation,
} from '../../navigation/navigation-types/navigation-types.js';
import { parseLocation } from '../../testkit/navigation.testkit.js';
import type { RouterLike, RouterNavigate } from '../react-router/index.js';
import { createHostNavigation } from './react-host-navigation.js';

export class ReactHostNavigationDriver {
  private readonly origin = faker.internet.url({ appendSlash: false });
  private readonly subscribers = new Set<() => void>();
  private readonly listener = jest.fn<(location: AtlasLocation) => void>();
  private readonly navigate = jest.fn<RouterNavigate>((to) => {
    if (typeof to === 'string') this.router.state.location = parseLocation(to);

    for (const subscriber of this.subscribers) subscriber();
  });
  private readonly router: RouterLike = {
    state: { location: parseLocation('/') },
    navigate: this.navigate,
    subscribe: (subscriber) => {
      this.subscribers.add(subscriber);

      return () => this.subscribers.delete(subscriber);
    },
  };
  private navigation!: AtlasNavigation;

  readonly given = {
    routerUrl: (url: string): this => {
      this.router.state.location = parseLocation(url);

      return this;
    },
  };

  readonly when = {
    created: (): void => {
      this.navigation = createHostNavigation(this.router, this.origin);
    },
    subscribed: (): void => {
      this.navigation.subscribe(this.listener);
    },
    navigated: (to: string): void => {
      this.navigation.navigate(to);
    },
    replaced: (to: string): void => {
      this.navigation.replace(to);
    },
    wentBack: (): void => {
      this.navigation.back();
    },
  };

  readonly get = {
    navigation: (): AtlasNavigation => this.navigation,
    navigateMock: (): jest.Mock<RouterNavigate> => this.navigate,
    listenerMock: (): jest.Mock<(location: AtlasLocation) => void> =>
      this.listener,
    origin: (): string => this.origin,
  };
}
