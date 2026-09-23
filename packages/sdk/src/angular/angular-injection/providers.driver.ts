import '@angular/compiler';
import { jest } from '@jest/globals';
import {
  APP_ID,
  createEnvironmentInjector,
  runInInjectionContext,
  type EnvironmentInjector,
} from '@angular/core';
import type { AtlasAppContext } from '../../lifecycle.js';
import { anAppContext } from '../../testkit/app-context.testkit.js';
import {
  injectAppLoaded,
  injectAtlasAppContext,
} from './inject-app-context.js';
import { provideAtlasAppContext } from './providers.js';

export class ProvidersDriver {
  private readonly waitUntilReady = jest.fn<() => () => void>(
    () => () => undefined,
  );
  private readonly context: AtlasAppContext = anAppContext({
    loading: {
      show: () => undefined,
      hide: () => undefined,
      waitUntilReady: this.waitUntilReady,
    },
  });
  private injector!: EnvironmentInjector;

  readonly when = {
    appContextProvided: () => {
      this.injector = createEnvironmentInjector(
        provideAtlasAppContext(this.context),
        null!,
      );
    },
    appLoadedInjected: () => {
      runInInjectionContext(this.injector, injectAppLoaded);
    },
  };

  readonly get = {
    context: () => this.context,
    appId: () => this.injector.get(APP_ID),
    injectedAppContext: () =>
      runInInjectionContext(this.injector, injectAtlasAppContext),
    waitUntilReadyMock: () => this.waitUntilReady,
  };
}
