import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasAppMountResult } from '../../lifecycle.js';
import type { AppRouterLike } from '../react-router/index.js';
import { createRoutedApp } from './create-routed-app.js';
import { aMountRequest, aRootAdapter } from './react-app.testkit.js';
import type { UnmountRoot } from './react-app.types.js';

export class CreateRoutedAppDriver {
  private readonly root = aRootAdapter();
  private readonly routerUnsubscribe = jest.fn<() => void>();
  private readonly routerDispose = jest.fn<() => void>();
  private readonly router: AppRouterLike = {
    state: { location: { pathname: '/' } },
    navigate: () => undefined,
    subscribe: () => this.routerUnsubscribe,
    dispose: this.routerDispose,
  };
  private readonly createElement = jest.fn<(router: AppRouterLike) => unknown>(
    () => faker.lorem.word(),
  );
  private mounted: AtlasAppMountResult | void = undefined;

  readonly when = {
    mounted: async (): Promise<void> => {
      this.mounted = await createRoutedApp({
        createRoot: this.root.createRoot,
        createRouter: () => this.router,
        createElement: (router) => this.createElement(router),
      }).mount(aMountRequest());
    },
    unmounted: async (): Promise<void> => {
      await this.mounted?.unmount?.();
    },
  };

  readonly get = {
    createElementMock: (): jest.Mock<(router: AppRouterLike) => unknown> =>
      this.createElement,
    router: (): AppRouterLike => this.router,
    routerUnsubscribeMock: (): jest.Mock<() => void> => this.routerUnsubscribe,
    routerDisposeMock: (): jest.Mock<() => void> => this.routerDispose,
    unmountRootMock: (): jest.Mock<UnmountRoot> => this.root.unmount,
  };
}
