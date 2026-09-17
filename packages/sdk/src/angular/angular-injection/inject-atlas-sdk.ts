import {
  ApplicationRef,
  DestroyRef,
  EnvironmentInjector,
  inject,
  signal,
  type Signal,
} from '@angular/core';
import {
  subscribeAtlasHostData,
  type AtlasEventMap,
  type AtlasHostDataValue,
  type AtlasSdk as AtlasSdkValue,
} from '../../host.js';
import {
  createAtlasAppAssetFacade,
  defineUnavailableAppAssets,
} from '../../core/app-assets/app-assets.js';
import {
  createAngularAtlasSdk,
  type AngularAtlasSdk,
} from '../angular-widget/index.js';
import { ATLAS_APP_CONTEXT, ATLAS_SDK } from './tokens.js';

export type AtlasSdk<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
> = AngularAtlasSdk<THostSdk, TEvents>;

/** Returns the Angular facade of the host SDK; asset helpers work only when an app context is provided. */
export function injectAtlasSdk<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
>(): AtlasSdk<THostSdk, TEvents> {
  const sdk = inject(ATLAS_SDK) as AtlasSdkValue<THostSdk, TEvents>;
  const context = inject(ATLAS_APP_CONTEXT, { optional: true });

  const atlas = createAngularAtlasSdk({
    sdk: context ? createAtlasAppAssetFacade(sdk, context) : sdk,
    applicationRef: inject(ApplicationRef),
    environmentInjector: inject(EnvironmentInjector),
    hostData: createAtlasHostDataSignal(sdk),
  });
  if (!context) defineUnavailableAppAssets(atlas);

  return atlas;
}

function createAtlasHostDataSignal<
  THostSdk extends object,
  TEvents extends object,
>(sdk: AtlasSdkValue<THostSdk, TEvents>): Signal<AtlasHostDataValue<THostSdk>> {
  const hostData = signal(sdk.hostData);
  const unsubscribe = subscribeAtlasHostData(sdk, () =>
    hostData.set(sdk.hostData),
  );
  inject(DestroyRef).onDestroy(unsubscribe);

  return hostData.asReadonly();
}
