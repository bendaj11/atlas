import { ApplicationRef, EnvironmentInjector, inject, InjectionToken, type Provider } from "@angular/core";
import type { AtlasAppContext } from "./lifecycle.js";
import type { AtlasSdk as AtlasSdkValue } from "./host.js";
import { createAngularAtlasSdk, type AngularAtlasSdk } from "./angular-widget.js";

const ATLAS_SDK = new InjectionToken<AtlasSdkValue>("AtlasSdk");
const ATLAS_APP_CONTEXT = new InjectionToken<AtlasAppContext>("AtlasAppContext");

export type AtlasSdk<THostSdk extends object = {}> = AngularAtlasSdk<THostSdk>;

export function provideAtlasSdk<THostSdk extends object>(sdk: AtlasSdkValue<THostSdk>): Provider {
  return { provide: ATLAS_SDK, useValue: sdk };
}

export function provideAtlasAppContext(context: AtlasAppContext): Provider {
  return { provide: ATLAS_APP_CONTEXT, useValue: context };
}

export function injectAtlasSdk<THostSdk extends object = {}>(): AtlasSdk<THostSdk> {
  return createAngularAtlasSdk(
    inject(ATLAS_SDK) as AtlasSdkValue<THostSdk>,
    inject(ApplicationRef),
    inject(EnvironmentInjector)
  );
}

export function injectAtlasAppContext(): AtlasAppContext {
  return inject(ATLAS_APP_CONTEXT);
}

export function injectAppLoaded(): () => void {
  return injectAtlasAppContext().loading.waitUntilReady();
}
