import type { ComponentType } from 'react';
import type { AtlasSdk as AtlasSdkValue } from '../../host.js';
import {
  createAtlasAppAssetFacade,
  defineUnavailableAppAssets,
} from '../../core/app-assets/app-assets.js';
import type { AtlasAppContext } from '../../lifecycle.js';
import { createWidgetComponent } from './widget-component.js';
import type {
  ReactAtlasSdk,
  ReactGetWidgetOptions,
} from './react-widget.types.js';

type WidgetCache = Map<
  string,
  Map<ComponentType | undefined, ComponentType<object>>
>;

const sdkFacades = new WeakMap<object, WeakMap<object, object>>();

/** Wraps the host SDK with React widget components and app asset helpers; one facade per (sdk, app context). */
export function createReactAtlasSdk<
  THostSdk extends object,
  TEvents extends object,
>(
  sdk: AtlasSdkValue<THostSdk, TEvents>,
  context?: AtlasAppContext,
): ReactAtlasSdk<THostSdk, TEvents> {
  const appFacades = sdkFacades.get(sdk) ?? new WeakMap<object, object>();
  sdkFacades.set(sdk, appFacades);

  const facadeContext = context ?? sdk;
  const cached = appFacades.get(facadeContext);
  if (cached) return cached as ReactAtlasSdk<THostSdk, TEvents>;

  const facade = Object.create(
    context ? createAtlasAppAssetFacade(sdk, context) : sdk,
  ) as ReactAtlasSdk<THostSdk, TEvents>;
  if (!context) defineUnavailableAppAssets(facade);
  Object.defineProperty(facade, 'getWidget', {
    value: createGetWidget(sdk, new Map()),
  });
  appFacades.set(facadeContext, facade);

  return facade;
}

function createGetWidget(
  sdk: Pick<AtlasSdkValue, 'getWidget'>,
  widgets: WidgetCache,
): ReactAtlasSdk['getWidget'] {
  return <TInputs extends object>(
    widgetId: string,
    options?: ReactGetWidgetOptions,
  ): ComponentType<TInputs> => {
    const loadingComponent = options?.loadingComponent;
    const widgetsByLoadingComponent = widgets.get(widgetId) ?? new Map();
    widgets.set(widgetId, widgetsByLoadingComponent);

    const cachedWidget = widgetsByLoadingComponent.get(loadingComponent);
    if (cachedWidget) return cachedWidget as ComponentType<TInputs>;

    const widget = createWidgetComponent<TInputs>({
      sdk,
      widgetId,
      loadingComponent,
    });
    widgetsByLoadingComponent.set(
      loadingComponent,
      widget as ComponentType<object>,
    );

    return widget;
  };
}
