import { faker } from '@faker-js/faker';
import type { AtlasAppContext } from '../../lifecycle.js';
import { createRouteContext } from '../../navigation/route-context/route-context.js';
import { createScopedNavigation } from '../../navigation/scoped-navigation/scoped-navigation.js';
import { anAppContext } from '../../testkit/app-context.testkit.js';
import {
  aMemoryNavigation,
  parseUrlIntoLocation,
  formatLocationAsUrl,
  type MemoryNavigation,
} from '../../testkit/navigation.testkit.js';
import {
  connectRouter,
  createRouterOptions,
  type AppRouterLike,
  type RouterLocation,
} from './index.js';

export class ReactRouterDriver {
  private readonly routerListeners = new Set<() => void>();
  private readonly path = `/${faker.lorem.slug()}`;
  private hostNavigation!: MemoryNavigation;
  private context!: AtlasAppContext;
  private router!: AppRouterLike;
  private disconnect: (() => void) | undefined;

  readonly given = {
    hostUrl: (innerUrl: string): this => {
      this.hostNavigation = aMemoryNavigation(`${this.path}${innerUrl}`);
      this.context = anAppContext({
        path: this.path,
        navigation: createScopedNavigation(this.path, this.hostNavigation),
        route: createRouteContext(this.path, this.hostNavigation),
      });
      this.router = this.createFakeRouter(innerUrl);

      return this;
    },
  };

  readonly when = {
    connected: (): void => {
      this.disconnect = connectRouter(this.router, this.context);
    },
    disconnected: (): void => {
      this.disconnect?.();
    },
    routerNavigated: (to: string, options?: { replace?: boolean }): void => {
      void this.router.navigate(to, options);
    },
    hostNavigated: async (innerUrl: string): Promise<void> => {
      this.context.navigation.navigate(innerUrl);

      await Promise.resolve();
    },
  };

  readonly get = {
    routerOptions: () => createRouterOptions(this.context),
    hostUrl: () =>
      formatLocationAsUrl(this.context.navigation.getCurrentLocation()),
    hostPath: (): string => this.path,
    routerLocation: (): RouterLocation => this.router.state.location,
    hostNavigateMock: () => this.hostNavigation.navigate,
    hostReplaceMock: () => this.hostNavigation.replace,
  };

  private createFakeRouter(innerUrl: string): AppRouterLike {
    const listeners = this.routerListeners;

    return {
      state: { location: parseUrlIntoLocation(innerUrl), historyAction: 'POP' },
      navigate(to, options) {
        if (typeof to !== 'string') return;
        this.state.location = parseUrlIntoLocation(to);
        this.state.historyAction = options?.replace ? 'REPLACE' : 'PUSH';

        for (const listener of listeners) listener();
      },
      subscribe(listener) {
        listeners.add(listener);

        return () => listeners.delete(listener);
      },
    };
  }
}
