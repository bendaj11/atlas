import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type {
  AtlasLocation,
  AtlasNavigation,
} from '../../navigation/navigation-types/navigation-types.js';
import type {
  LocationBack,
  LocationHistoryGo,
  LocationLike,
  NavigateByUrl,
  RouterLike,
} from '../angular-types/angular-types.js';
import { createHostNavigation } from './angular-host-navigation.js';

export class AngularHostNavigationDriver {
  private readonly origin = faker.internet.url({ appendSlash: false });
  private readonly listener = jest.fn<(location: AtlasLocation) => void>();
  private readonly back = jest.fn<LocationBack>();
  private readonly historyGo = jest.fn<LocationHistoryGo>();
  private readonly navigateByUrl = jest.fn<NavigateByUrl>(async (url) => {
    this.currentUrl = url;
    this.routerListener?.();

    return true;
  });
  private readonly router: RouterLike = {
    url: '/',
    navigateByUrl: this.navigateByUrl,
    events: {
      subscribe: (listener) => {
        this.routerListener = listener;

        return {
          unsubscribe: () => {
            this.routerListener = undefined;
          },
        };
      },
    },
  };
  private routerListener: (() => void) | undefined;
  private currentUrl = '/';
  private location: LocationLike = { back: this.back };
  private navigation!: AtlasNavigation;

  constructor() {
    Object.defineProperty(this.router, 'url', { get: () => this.currentUrl });
  }

  readonly given = {
    routerUrl: (url: string) => {
      this.currentUrl = url;

      return this;
    },
    historyGoSupported: (supported: boolean) => {
      this.location = supported
        ? { back: this.back, historyGo: this.historyGo }
        : { back: this.back };

      return this;
    },
  };

  readonly when = {
    created: () => {
      this.navigation = createHostNavigation(
        this.router,
        this.location,
        this.origin,
      );
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
    historyMoved: (delta: number) => {
      this.navigation.go?.(delta);
    },
    routerEventEmitted: () => {
      this.routerListener?.();
    },
    routerUrlChanged: (url: string) => {
      this.currentUrl = url;
    },
  };

  readonly get = {
    navigation: () => this.navigation,
    origin: () => this.origin,
    navigateByUrlMock: () => this.navigateByUrl,
    backMock: () => this.back,
    historyGoMock: () => this.historyGo,
    listenerMock: () => this.listener,
  };
}
