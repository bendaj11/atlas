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
  injectAppFailed,
  injectAppLoaded,
  injectAtlasAppContext,
} from './inject-app-context.js';
import { provideAtlasAppContext } from './providers.js';

export class ProvidersDriver {
  private readonly waitUntilReady = jest.fn<() => () => void>(
    () => () => undefined,
  );
  private readonly fail = jest.fn<(error: unknown) => void>();
  private readonly context: AtlasAppContext = anAppContext({
    loading: {
      show: () => undefined,
      hide: () => undefined,
      waitUntilReady: this.waitUntilReady,
    },
    fail: this.fail,
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
    appFailedReported: (error: unknown) =>
      runInInjectionContext(this.injector, injectAppFailed)(error),
  };

  readonly get = {
    context: () => this.context,
    appId: () => this.injector.get(APP_ID),
    injectedAppContext: () =>
      runInInjectionContext(this.injector, injectAtlasAppContext),
    waitUntilReadyMock: () => this.waitUntilReady,
    failMock: () => this.fail,
  };
}
