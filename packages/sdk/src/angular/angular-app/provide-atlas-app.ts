import {
  ENVIRONMENT_INITIALIZER,
  ErrorHandler,
  inject,
  makeEnvironmentProviders,
  type EnvironmentProviders,
  type Provider,
} from '@angular/core';
import { LocationStrategy } from '@angular/common';
import { ɵSharedStylesHost } from '@angular/platform-browser';
import type { AtlasSdk as AtlasSdkValue } from '../../host.js';
import type { AtlasAppContext } from '../../lifecycle.js';
import {
  provideAtlasAppContext,
  provideAtlasSdk,
} from '../angular-injection/index.js';
import { attachAngularComponentStyles } from '../angular-style-host/angular-style-host.js';
import type { LocationStrategyAdapter } from '../angular-types/angular-types.js';

export interface AtlasAngularAppOptions {
  readonly context: AtlasAppContext;
  readonly sdk: AtlasSdkValue;
  readonly styleTarget: Node & ParentNode;
  readonly locationStrategy?: LocationStrategyAdapter;
}

/** Provides Atlas app context, SDK, runtime styles, error reporting, and optional router strategy. */
export function provideAtlasApp(
  options: AtlasAngularAppOptions,
): EnvironmentProviders {
  const { sdk, styleTarget, locationStrategy } = options;
  let pendingReadiness = 0;
  const context: AtlasAppContext = {
    ...options.context,
    loading: {
      ...options.context.loading,
      waitUntilReady: () => {
        const markReady = options.context.loading.waitUntilReady();
        let released = false;

        pendingReadiness += 1;

        return () => {
          if (released) return;

          released = true;
          pendingReadiness -= 1;
          markReady();
        };
      },
    },
  };

  return makeEnvironmentProviders([
    provideAtlasAngularStyles(styleTarget),
    ...provideAtlasAppContext(context),
    {
      provide: ErrorHandler,
      useFactory: () =>
        new AtlasErrorHandler({
          context,
          isLoading: () => pendingReadiness > 0,
        }),
    },
    provideAtlasSdk(sdk),
    ...(locationStrategy
      ? [{ provide: LocationStrategy, useValue: locationStrategy }]
      : []),
  ]);
}

/** Adds Atlas Shadow DOM style hosting without taking over application bootstrap. */
function provideAtlasAngularStyles(styleTarget: Node & ParentNode): Provider {
  return {
    provide: ENVIRONMENT_INITIALIZER,
    multi: true,
    useValue: () =>
      attachAngularComponentStyles({
        styleHost: inject(ɵSharedStylesHost),
        styleTarget,
        documentHead: styleTarget.ownerDocument?.head,
      }),
  };
}

/** Logs like Angular's default handler and fails the app when an error occurs before it marks itself ready. */
class AtlasErrorHandler extends ErrorHandler {
  constructor(
    private readonly input: {
      context: AtlasAppContext;
      isLoading: () => boolean;
    },
  ) {
    super();
  }

  override handleError(error: unknown): void {
    super.handleError(error);

    if (this.input.isLoading()) this.input.context.fail(error);
  }
}
