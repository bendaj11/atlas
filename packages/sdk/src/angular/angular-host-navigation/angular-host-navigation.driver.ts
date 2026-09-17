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
    routerUrl: (url: string): this => {
      this.currentUrl = url;

      return this;
    },
    historyGoSupported: (supported: boolean): this => {
      this.location = supported
        ? { back: this.back, historyGo: this.historyGo }
        : { back: this.back };

      return this;
    },
  };

  readonly when = {
    created: (): void => {
      this.navigation = createHostNavigation(
        this.router,
        this.location,
        this.origin,
      );
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
    historyMoved: (delta: number): void => {
      this.navigation.go?.(delta);
    },
    routerEventEmitted: (): void => {
      this.routerListener?.();
    },
    routerUrlChanged: (url: string): void => {
      this.currentUrl = url;
    },
  };

  readonly get = {
    navigation: (): AtlasNavigation => this.navigation,
    origin: (): string => this.origin,
    navigateByUrlMock: (): jest.Mock<NavigateByUrl> => this.navigateByUrl,
    backMock: (): jest.Mock<LocationBack> => this.back,
    historyGoMock: (): jest.Mock<LocationHistoryGo> => this.historyGo,
    listenerMock: (): jest.Mock<(location: AtlasLocation) => void> =>
      this.listener,
  };
}
