import type { ComponentType } from 'react';
import type { AtlasEventMap, AtlasSdk as AtlasSdkValue } from '../../host.js';
import type { AtlasAppAssets } from '../../core/app-assets/app-assets.js';

export interface ReactGetWidgetOptions {
  loadingComponent?: ComponentType;
}

export type ReactAtlasSdk<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
> = Omit<AtlasSdkValue<THostSdk, TEvents>, 'getWidget'> &
  AtlasAppAssets & {
    getWidget<TInputs extends object>(
      widgetId: string,
      options?: ReactGetWidgetOptions,
    ): ComponentType<TInputs>;
  };
