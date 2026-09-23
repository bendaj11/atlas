import { faker } from '@faker-js/faker';
import type {
  AtlasLocation,
  AtlasScopedNavigation,
} from '../navigation-types/navigation-types.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import { jest } from '@jest/globals';
import { createScopedNavigation } from './scoped-navigation.js';

export class ScopedNavigationDriver {
  private readonly hostNavigation = aMemoryNavigation();
  private readonly listener = jest.fn<(location: AtlasLocation) => void>();
  private path = `/${faker.lorem.slug()}`;
  private scoped!: AtlasScopedNavigation;

  readonly given = {
    path: (path: string) => {
      this.path = path;

      return this;
    },
  };

  readonly when = {
    created: () => {
      this.scoped = createScopedNavigation(this.path, this.hostNavigation);
    },
    navigated: (to: string) => {
      this.scoped.navigate(to);
    },
    replaced: (to: string) => {
      this.scoped.replace(to);
    },
    historyMoved: (delta: number) => {
      this.scoped.go?.(delta);
    },
    wentBack: () => {
      this.scoped.back();
    },
    subscribed: () => {
      this.scoped.subscribe(this.listener);
    },
  };

  readonly get = {
    scoped: () => this.scoped,
    hostNavigation: () => this.hostNavigation,
    listenerMock: () => this.listener,
  };
}
