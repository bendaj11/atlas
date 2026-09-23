import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasAppContext } from '../../lifecycle.js';
import { anAppContext } from '../../testkit/app-context.testkit.js';
import { locationToUrl } from '../../testkit/navigation.testkit.js';
import type {
  LocationStrategyAdapter,
  PopStateListener,
} from '../angular-types/angular-types.js';
import { createLocationStrategy } from './angular-location-strategy.js';

export class AngularLocationStrategyDriver {
  private readonly path = `/${faker.lorem.slug()}`;
  private readonly popState = jest.fn<PopStateListener>();
  private context!: AtlasAppContext;
  private strategy!: LocationStrategyAdapter;

  readonly given = {
    innerUrl: (innerUrl: string) => {
      this.context = anAppContext({ path: this.path });
      this.context.navigation.navigate(innerUrl);

      return this;
    },
  };

  readonly when = {
    created: () => {
      this.strategy = createLocationStrategy(this.context);
      this.strategy.onPopState(this.popState);
    },
    routerPushed: (url: string, query: string) => {
      this.strategy.pushState(undefined, '', url, query);
    },
    routerReplaced: (url: string, query: string) => {
      this.strategy.replaceState(undefined, '', url, query);
    },
    hostNavigated: (innerUrl: string) => {
      this.context.navigation.navigate(innerUrl);
    },
    destroyed: () => {
      this.strategy.ngOnDestroy();
    },
  };

  readonly get = {
    strategy: () => this.strategy,
    hostPath: () => this.path,
    hostUrl: () => locationToUrl(this.context.navigation.getCurrentLocation()),
    popStateMock: () => this.popState,
    hostGoMock: () => this.context.navigation.go,
    hostBackMock: () => this.context.navigation.back,
  };
}
