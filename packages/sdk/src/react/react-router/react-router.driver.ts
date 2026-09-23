import { faker } from '@faker-js/faker';
import type { AtlasAppContext } from '../../lifecycle.js';
import { anAppContext } from '../../testkit/app-context.testkit.js';
import {
  parseLocation,
  locationToUrl,
} from '../../testkit/navigation.testkit.js';
import {
  connectRouter,
  createRouterOptions,
  type AppRouterLike,
} from './index.js';

export class ReactRouterDriver {
  private readonly routerListeners = new Set<() => void>();
  private readonly path = `/${faker.lorem.slug()}`;
  private context!: AtlasAppContext;
  private router!: AppRouterLike;
  private disconnect: (() => void) | undefined;

  readonly given = {
    hostUrl: (innerUrl: string) => {
      this.context = anAppContext({ path: this.path });
      this.context.navigation.navigate(innerUrl);
      this.router = this.createRouter(innerUrl);

      return this;
    },
  };

  readonly when = {
    connected: () => {
      this.disconnect = connectRouter(this.router, this.context);
    },
    disconnected: () => {
      this.disconnect?.();
    },
    routerNavigated: (to: string, options?: { replace?: boolean }) => {
      void this.router.navigate(to, options);
    },
    hostNavigated: async (innerUrl: string) => {
      this.context.navigation.navigate(innerUrl);
      await Promise.resolve();
    },
  };

  readonly get = {
    routerOptions: () => createRouterOptions(this.context),
    hostUrl: () => locationToUrl(this.context.navigation.getCurrentLocation()),
    hostPath: () => this.path,
    routerLocation: () => this.router.state.location,
  };

  private createRouter(innerUrl: string): AppRouterLike {
    const listeners = this.routerListeners;

    return {
      state: { location: parseLocation(innerUrl), historyAction: 'POP' },
      navigate(to, options) {
        if (typeof to !== 'string') return;
        this.state.location = parseLocation(to);
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
