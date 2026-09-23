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
  ReactGetWidget,
  ReactGetWidgetOptions,
} from './react-widget.types.js';

type WidgetsByLoadingComponent = Map<
  ComponentType | undefined,
  ComponentType<never>
>;

type WidgetCache = Map<string, WidgetsByLoadingComponent>;

type ReactFacadesByAppContext<
  THostSdk extends object,
  TEvents extends object,
> = WeakMap<object, ReactAtlasSdk<THostSdk, TEvents>>;

const REACT_FACADES = Symbol.for('@atlas/sdk/react-facades');

/** Wraps the host SDK with React widget components and app asset helpers; one facade per (sdk, app context). */
export function createReactAtlasSdk<
  THostSdk extends object,
  TEvents extends object,
>(
  sdk: AtlasSdkValue<THostSdk, TEvents>,
  context?: AtlasAppContext,
): ReactAtlasSdk<THostSdk, TEvents> {
  const facades = getFacadesOf<THostSdk, TEvents>(sdk);
  const facadeContext = context ?? sdk;
  const cached = facades.get(facadeContext);

  if (cached) return cached;

  const facade: ReactAtlasSdk<THostSdk, TEvents> = Object.create(
    context ? createAtlasAppAssetFacade(sdk, context) : sdk,
  );

  if (!context) defineUnavailableAppAssets(facade);
  Object.defineProperty(facade, 'getWidget', {
    value: createWidgetComponentGetter(sdk, new Map()),
  });
  facades.set(facadeContext, facade);

  return facade;
}

function getFacadesOf<THostSdk extends object, TEvents extends object>(
  sdk: object,
): ReactFacadesByAppContext<THostSdk, TEvents> {
  const existing: ReactFacadesByAppContext<THostSdk, TEvents> | undefined =
    Reflect.get(sdk, REACT_FACADES);

  if (existing) return existing;

  const facades: ReactFacadesByAppContext<THostSdk, TEvents> = new WeakMap();
  Object.defineProperty(sdk, REACT_FACADES, { value: facades });

  return facades;
}

function createWidgetComponentGetter(
  sdk: Pick<AtlasSdkValue, 'getWidget'>,
  widgets: WidgetCache,
): ReactGetWidget {
  return <TInputs extends object>(
    widgetId: string,
    options?: ReactGetWidgetOptions,
  ): ComponentType<TInputs> => {
    const loadingComponent = options?.loadingComponent;
    const widgetsByLoadingComponent = widgets.get(widgetId) ?? new Map();
    widgets.set(widgetId, widgetsByLoadingComponent);

    const cachedWidget = widgetsByLoadingComponent.get(loadingComponent);

    if (cachedWidget) return cachedWidget;

    const widget = createWidgetComponent<TInputs>({
      sdk,
      widgetId,
      loadingComponent,
    });
    widgetsByLoadingComponent.set(loadingComponent, widget);

    return widget;
  };
}
