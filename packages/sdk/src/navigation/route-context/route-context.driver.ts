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
    path: (path: string) => {
      this.path = path;

      return this;
    },
    hostUrl: (hostUrl: string) => {
      this.hostUrl = hostUrl;

      return this;
    },
  };

  readonly when = {
    created: () => {
      this.hostNavigation = aMemoryNavigation(this.hostUrl);
      this.route = createRouteContext(this.path, this.hostNavigation, {
        setTabTitle: this.setTabTitle,
      });
    },
    subscribed: () => {
      this.route.subscribe(this.listener);
    },
    hostNavigated: (to: string) => {
      this.hostNavigation.navigate(to);
    },
    tabTitleSet: (title: string) => {
      this.route.setTabTitle(title);
    },
  };

  readonly get = {
    route: () => this.route,
    setTabTitleMock: () => this.setTabTitle,
    listenerMock: () => this.listener,
  };
}
