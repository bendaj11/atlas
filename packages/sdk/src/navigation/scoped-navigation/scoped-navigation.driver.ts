import { faker } from '@faker-js/faker';
import type { AtlasScopedNavigation } from '../navigation-types/navigation-types.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import { createScopedNavigation } from './scoped-navigation.js';

export class ScopedNavigationDriver {
  private readonly hostNavigation = aMemoryNavigation();
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
  };

  readonly get = {
    scoped: () => this.scoped,
    hostNavigation: () => this.hostNavigation,
  };
}
