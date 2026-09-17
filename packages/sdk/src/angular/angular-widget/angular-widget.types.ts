import type { Signal, Type } from '@angular/core';
import type {
  AtlasEventMap,
  AtlasHostDataValue,
  AtlasMountedWidgetHandle,
  AtlasSdk as AtlasSdkValue,
  AtlasWidgetHandle,
} from '../../host.js';
import type { AtlasAppAssets } from '../../core/app-assets/app-assets.js';

export interface AngularGetWidgetOptions<TInputs extends object> {
  readonly inputs: TInputs;
  readonly loadingComponent?: Type<unknown>;
}

export interface AngularWidgetBinding<TInputs extends object> {
  readonly widgetId: string;
  readonly inputs: TInputs;
}

export type AngularAtlasSdk<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
> = Omit<AtlasSdkValue<THostSdk, TEvents>, 'getWidget' | 'hostData'> &
  AtlasAppAssets & {
    /** Live, host-owned data. Call it to read the current immutable snapshot. */
    readonly hostData: Signal<AtlasHostDataValue<THostSdk>>;
    getWidget<TInputs extends object>(
      widgetId: string,
      options: AngularGetWidgetOptions<TInputs>,
    ): AngularWidgetBinding<TInputs>;
  };

export interface WidgetBindingRuntime {
  readonly widgetId: string;
  readonly handle: AtlasWidgetHandle<object>;
  readonly loadingComponent?: Type<unknown>;
}

export interface MountedWidgetRecord {
  readonly widgetId: string;
  readonly loadingComponent?: Type<unknown>;
  readonly mounted: AtlasMountedWidgetHandle<object>;
}

export type WidgetErrorHandler = (error: unknown) => void;
