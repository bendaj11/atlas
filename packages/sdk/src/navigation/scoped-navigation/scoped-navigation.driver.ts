import { faker } from '@faker-js/faker';
import type { AtlasScopedNavigation } from '../navigation-types/navigation-types.js';
import {
  aMemoryNavigation,
  type MemoryNavigation,
} from '../../testkit/navigation.testkit.js';
import { createScopedNavigation } from './scoped-navigation.js';

export class ScopedNavigationDriver {
  private readonly hostNavigation = aMemoryNavigation();
  private path = `/${faker.lorem.slug()}`;
  private scoped!: AtlasScopedNavigation;

  readonly given = {
    path: (path: string): this => {
      this.path = path;

      return this;
    },
  };

  readonly when = {
    created: (): void => {
      this.scoped = createScopedNavigation(this.path, this.hostNavigation);
    },
    navigated: (to: string): void => {
      this.scoped.navigate(to);
    },
    replaced: (to: string): void => {
      this.scoped.replace(to);
    },
    historyMoved: (delta: number): void => {
      this.scoped.go?.(delta);
    },
    wentBack: (): void => {
      this.scoped.back();
    },
  };

  readonly get = {
    scoped: (): AtlasScopedNavigation => this.scoped,
    hostNavigation: (): MemoryNavigation => this.hostNavigation,
  };
}
