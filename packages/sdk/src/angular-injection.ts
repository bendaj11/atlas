import {
  APP_ID,
  ApplicationRef,
  DestroyRef,
  EnvironmentInjector,
  inject,
  InjectionToken,
  signal,
  type Provider,
  type Signal,
} from '@angular/core';
import type { AtlasAppContext } from './lifecycle.js';
import {
  subscribeAtlasHostData,
  type AtlasEventMap,
  type AtlasHostDataValue,
  type AtlasSdk as AtlasSdkValue,
} from './host.js';
import {
  createAngularAtlasSdk,
  type AngularAtlasSdk,
} from './angular-widget.js';

const ATLAS_SDK = new InjectionToken<AtlasSdkValue>('AtlasSdk');
const ATLAS_APP_CONTEXT = new InjectionToken<AtlasAppContext>(
  'AtlasAppContext',
);

export type AtlasSdk<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
> = AngularAtlasSdk<THostSdk, TEvents>;

export function provideAtlasSdk<
  THostSdk extends object,
  TEvents extends object,
>(sdk: AtlasSdkValue<THostSdk, TEvents>): Provider {
  return { provide: ATLAS_SDK, useValue: sdk };
}

export function provideAtlasAppContext(context: AtlasAppContext): Provider[] {
  return [
    { provide: ATLAS_APP_CONTEXT, useValue: context },
    { provide: APP_ID, useValue: context.manifest.id },
  ];
}

export function injectAtlasSdk<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
>(): AtlasSdk<THostSdk, TEvents> {
  const sdk = inject(ATLAS_SDK) as AtlasSdkValue<THostSdk, TEvents>;
  return createAngularAtlasSdk(
    sdk,
    inject(ApplicationRef),
    inject(EnvironmentInjector),
    createAtlasHostDataSignal(sdk),
  );
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

export function injectAtlasAppContext(): AtlasAppContext {
  return inject(ATLAS_APP_CONTEXT);
}

export function injectAppLoaded(): () => void {
  return injectAtlasAppContext().loading.waitUntilReady();
}
