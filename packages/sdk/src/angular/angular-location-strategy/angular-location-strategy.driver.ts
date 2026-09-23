import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasAppContext } from '../../lifecycle.js';
import { createRouteContext } from '../../navigation/route-context/route-context.js';
import { createScopedNavigation } from '../../navigation/scoped-navigation/scoped-navigation.js';
import { anAppContext } from '../../testkit/app-context.testkit.js';
import {
  aMemoryNavigation,
  formatLocationAsUrl,
  type MemoryNavigation,
} from '../../testkit/navigation.testkit.js';
import type {
  LocationStrategyAdapter,
  PopStateListener,
} from '../angular-types/angular-types.js';
import { createLocationStrategy } from './angular-location-strategy.js';

export class AngularLocationStrategyDriver {
  private readonly path = `/${faker.lorem.slug()}`;
  private readonly popState = jest.fn<PopStateListener>();
  private readonly hostNavigation: MemoryNavigation = aMemoryNavigation(
    this.path,
  );
  private context!: AtlasAppContext;
  private strategy!: LocationStrategyAdapter;

  readonly given = {
    innerUrl: (innerUrl: string): this => {
      this.context = anAppContext({
        path: this.path,
        navigation: createScopedNavigation(this.path, this.hostNavigation),
        route: createRouteContext(this.path, this.hostNavigation),
      });
      this.context.navigation.navigate(innerUrl);

      return this;
    },
  };

  readonly when = {
    created: (): void => {
      this.strategy = createLocationStrategy(this.context);
      this.strategy.onPopState(this.popState);
    },
    routerPushed: (url: string, query: string): void => {
      this.strategy.pushState(undefined, '', url, query);
    },
    routerReplaced: (url: string, query: string): void => {
      this.strategy.replaceState(undefined, '', url, query);
    },
    hostNavigated: (innerUrl: string): void => {
      this.context.navigation.navigate(innerUrl);
    },
    routerWentForward: (): void => {
      this.strategy.forward();
    },
    routerWentBack: (): void => {
      this.strategy.back();
    },
    routerWentThroughHistory: (delta: number): void => {
      this.strategy.historyGo?.(delta);
    },
    destroyed: (): void => {
      this.strategy.ngOnDestroy();
    },
  };

  readonly get = {
    strategy: (): LocationStrategyAdapter => this.strategy,
    hostPath: (): string => this.path,
    hostUrl: () =>
      formatLocationAsUrl(this.context.navigation.getCurrentLocation()),
    popStateMock: (): jest.Mock<PopStateListener> => this.popState,
    hostGoMock: () => this.hostNavigation.go,
    hostBackMock: () => this.hostNavigation.back,
  };
}
