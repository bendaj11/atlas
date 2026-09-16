import { faker } from '@faker-js/faker';
import type { AtlasAppContext } from '../../lifecycle.js';
import { anAppContext } from '../../testkit/app-context.testkit.js';
import { splitUrl, urlOf } from '../../testkit/navigation.testkit.js';
import {
  connectRouter,
  createRouterOptions,
  type AppRouterLike,
} from './react-router.js';

export class ReactRouterDriver {
  private readonly routerListeners = new Set<() => void>();
  private readonly path = `/${faker.lorem.slug()}`;
  private context!: AtlasAppContext;
  private router!: AppRouterLike;
  private disconnect: (() => void) | undefined;

  readonly given = {
    hostUrl: (innerUrl: string): this => {
      this.context = anAppContext({ path: this.path });
      this.context.navigation.navigate(innerUrl);
      this.router = this.createRouter(innerUrl);

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
    routerOptions: (): { initialEntries: string[] } =>
      createRouterOptions(this.context),
    hostUrl: (): string => urlOf(this.context.navigation.getCurrentLocation()),
    hostPath: (): string => this.path,
    routerLocation: (): AppRouterLike['state']['location'] =>
      this.router.state.location,
  };

  private createRouter(innerUrl: string): AppRouterLike {
    const listeners = this.routerListeners;

    return {
      state: { location: splitUrl(innerUrl), historyAction: 'POP' },
      navigate(to, options) {
        if (typeof to !== 'string') return;
        this.state.location = splitUrl(to);
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
