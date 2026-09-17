import {
  ENVIRONMENT_INITIALIZER,
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

/** Provides Atlas app context, SDK, runtime styles, and optional router strategy. */
export function provideAtlasApp(
  options: AtlasAngularAppOptions,
): EnvironmentProviders {
  const { context, sdk, styleTarget, locationStrategy } = options;

  return makeEnvironmentProviders([
    provideAtlasAngularStyles(styleTarget),
    ...provideAtlasAppContext(context),
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
