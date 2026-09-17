import type {
  ApplicationRef,
  EnvironmentInjector,
  Signal,
} from '@angular/core';
import type {
  AtlasHostDataValue,
  AtlasSdk as AtlasSdkValue,
} from '../../host.js';
import { createWidgetBinding } from './angular-widget-binding.js';
import type {
  AngularAtlasSdk,
  AngularGetWidgetOptions,
  AngularWidgetBinding,
} from './angular-widget.types.js';

export interface CreateAngularAtlasSdkInput<
  THostSdk extends object,
  TEvents extends object,
> {
  readonly sdk: AtlasSdkValue<THostSdk, TEvents>;
  readonly applicationRef: ApplicationRef;
  readonly environmentInjector: EnvironmentInjector;
  readonly hostData: Signal<AtlasHostDataValue<THostSdk>>;
}

/** Wraps the host SDK with Angular-native host data and widget bindings. */
export function createAngularAtlasSdk<
  THostSdk extends object,
  TEvents extends object,
>(
  input: CreateAngularAtlasSdkInput<THostSdk, TEvents>,
): AngularAtlasSdk<THostSdk, TEvents> {
  const { sdk, applicationRef, environmentInjector, hostData } = input;

  const facade = Object.create(sdk) as AngularAtlasSdk<THostSdk, TEvents>;
  Object.defineProperty(facade, 'hostData', { value: hostData });
  Object.defineProperty(facade, 'getWidget', {
    value: <TInputs extends object>(
      widgetId: string,
      options: AngularGetWidgetOptions<TInputs>,
    ): AngularWidgetBinding<TInputs> =>
      createWidgetBinding({
        sdk,
        applicationRef,
        environmentInjector,
        widgetId,
        options,
      }),
  });

  return facade;
}
