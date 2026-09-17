import { APP_ID, type Provider } from '@angular/core';
import type { AtlasEventMap, AtlasSdk as AtlasSdkValue } from '../../host.js';
import type { AtlasAppContext } from '../../lifecycle.js';
import { ATLAS_APP_CONTEXT, ATLAS_SDK } from './tokens.js';

export type AtlasSdkFactory<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
> = () => AtlasSdkValue<THostSdk, TEvents>;

export function provideAtlasSdk<
  THostSdk extends object,
  TEvents extends object,
>(sdk: AtlasSdkValue<THostSdk, TEvents>): Provider;
export function provideAtlasSdk<
  THostSdk extends object,
  TEvents extends object,
>(sdkFactory: AtlasSdkFactory<THostSdk, TEvents>): Provider;
export function provideAtlasSdk(
  sdk: AtlasSdkValue | AtlasSdkFactory,
): Provider {
  return typeof sdk === 'function'
    ? { provide: ATLAS_SDK, useFactory: sdk }
    : { provide: ATLAS_SDK, useValue: sdk };
}

/** Provides the app context and reuses the manifest id as `APP_ID` so component styles stay app-scoped. */
export function provideAtlasAppContext(context: AtlasAppContext): Provider[] {
  return [
    { provide: ATLAS_APP_CONTEXT, useValue: context },
    { provide: APP_ID, useValue: context.manifest.id },
  ];
}
