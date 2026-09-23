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
    routerUrl: (url: string) => {
      this.router.state.location = parseLocation(url);

      return this;
    },
  };

  readonly when = {
    created: () => {
      this.navigation = createHostNavigation(this.router, this.origin);
    },
    subscribed: () => {
      this.navigation.subscribe(this.listener);
    },
    navigated: (to: string) => {
      this.navigation.navigate(to);
    },
    replaced: (to: string) => {
      this.navigation.replace(to);
    },
    wentBack: () => {
      this.navigation.back();
    },
  };

  readonly get = {
    navigation: () => this.navigation,
    navigateMock: () => this.navigate,
    listenerMock: () => this.listener,
    origin: () => this.origin,
  };
}
