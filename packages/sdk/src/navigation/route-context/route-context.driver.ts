import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type {
  AtlasInnerLocation,
  AtlasRouteContext,
} from '../navigation-types/navigation-types.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import { createRouteContext } from './route-context.js';

export class RouteContextDriver {
  private readonly setTabTitle = jest.fn<(title: string) => void>();
  private readonly listener = jest.fn<(location: AtlasInnerLocation) => void>();
  private hostUrl = `/${faker.lorem.slug()}`;
  private path = `/${faker.lorem.slug()}`;
  private hostNavigation = aMemoryNavigation();
  private route!: AtlasRouteContext;

  readonly given = {
    path: (path: string): this => {
      this.path = path;

      return this;
    },
    hostUrl: (hostUrl: string): this => {
      this.hostUrl = hostUrl;

      return this;
    },
  };

  readonly when = {
    created: (): void => {
      this.hostNavigation = aMemoryNavigation(this.hostUrl);
      this.route = createRouteContext(this.path, this.hostNavigation, {
        setTabTitle: this.setTabTitle,
      });
    },
    subscribed: (): void => {
      this.route.subscribe(this.listener);
    },
    hostNavigated: (to: string): void => {
      this.hostNavigation.navigate(to);
    },
    tabTitleSet: (title: string): void => {
      this.route.setTabTitle(title);
    },
  };

  readonly get = {
    route: (): AtlasRouteContext => this.route,
    setTabTitleMock: (): jest.Mock<(title: string) => void> => this.setTabTitle,
    listenerMock: (): jest.Mock<(location: AtlasInnerLocation) => void> =>
      this.listener,
  };
}
