import { inject, InjectionToken, type Provider } from "@angular/core";
import type { AtlasMfContext } from "./lifecycle.js";
import type { AtlasEventMap, AtlasSdk as AtlasSdkValue } from "./host.js";

const ATLAS_SDK = new InjectionToken<AtlasSdkValue>("AtlasSdk");
const ATLAS_MF_CONTEXT = new InjectionToken<AtlasMfContext>("AtlasMfContext");

export type AtlasSdk<
  TExtensions extends object = {},
  TEvents extends object = AtlasEventMap,
  THostData extends object = {}
> = AtlasSdkValue<TExtensions, TEvents, THostData>;

export function provideAtlasSdk<
  TExtensions extends object,
  TEvents extends object = AtlasEventMap,
  THostData extends object = {}
>(sdk: AtlasSdk<TExtensions, TEvents, THostData>): Provider {
  return { provide: ATLAS_SDK, useValue: sdk };
}

export function provideAtlasMfContext(context: AtlasMfContext): Provider {
  return { provide: ATLAS_MF_CONTEXT, useValue: context };
}

export function injectAtlasSdk<
  TExtensions extends object = {},
  TEvents extends object = AtlasEventMap,
  THostData extends object = {}
>(): AtlasSdk<TExtensions, TEvents, THostData> {
  return inject(ATLAS_SDK) as AtlasSdk<TExtensions, TEvents, THostData>;
}

export function injectAtlasMfContext(): AtlasMfContext {
  return inject(ATLAS_MF_CONTEXT);
}

export function injectAppLoaded(): () => void {
  return injectAtlasMfContext().loading.waitUntilReady();
}
