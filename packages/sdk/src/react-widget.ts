import {
  Fragment,
  createElement,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type FunctionComponent,
} from 'react';
import type {
  AtlasEventMap,
  AtlasMountedWidgetHandle,
  AtlasSdk as AtlasSdkValue,
} from './host.js';
import {
  createAtlasAppAssetFacade,
  type AtlasAppAssets,
} from './app-assets.js';
import type { AtlasAppContext } from './lifecycle.js';
import { sdkError } from './sdk-error.js';

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

const sdkFacades = new WeakMap<object, WeakMap<object, object>>();

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

  const widgets = new Map<
    string,
    Map<ComponentType | undefined, ComponentType<object>>
  >();
  const facade = Object.create(
    context ? createAtlasAppAssetFacade(sdk, context) : sdk,
  ) as ReactAtlasSdk<THostSdk, TEvents>;
  if (!context) {
    Object.defineProperties(facade, {
      assetBaseUrl: { value: unavailableAppAssetUrl },
      assetUrl: { value: unavailableAppAssetUrl },
    });
  }
  Object.defineProperty(facade, 'getWidget', {
    value: <TInputs extends object>(
      widgetId: string,
      options?: ReactGetWidgetOptions,
    ): ComponentType<TInputs> => {
      const loadingComponent = options?.loadingComponent;
      const widgetsByLoadingComponent = widgets.get(widgetId) ?? new Map();
      widgets.set(widgetId, widgetsByLoadingComponent);
      const cachedWidget = widgetsByLoadingComponent.get(loadingComponent);
      if (cachedWidget) return cachedWidget as ComponentType<TInputs>;

      const widget = createWidgetComponent<TInputs>(
        sdk,
        widgetId,
        loadingComponent,
      );
      widgetsByLoadingComponent.set(
        loadingComponent,
        widget as ComponentType<object>,
      );
      return widget;
    },
  });
  appFacades.set(facadeContext, facade);
  return facade;
}

function unavailableAppAssetUrl(): never {
  throw sdkError('App asset URLs require an Atlas app context.', {
    suggestedActions:
      'Call assetBaseUrl() or assetUrl() inside a mounted app. Hosts should use their own asset URLs.',
    code: 'ATLAS_REACT_APP_CONTEXT_MISSING',
  });
}

function createWidgetComponent<TInputs extends object>(
  sdk: Pick<AtlasSdkValue, 'getWidget'>,
  widgetId: string,
  LoadingComponent?: ComponentType,
): FunctionComponent<TInputs> {
  const Widget: FunctionComponent<TInputs> = (inputs) => {
    const container = useRef<HTMLDivElement>(null);
    const mountedWidget = useRef<AtlasMountedWidgetHandle<TInputs> | undefined>(
      undefined,
    );
    const latestInputs = useRef(inputs);
    const [isLoading, setIsLoading] = useState(false);
    latestInputs.current = inputs;

    useEffect(() => {
      const element = container.current;
      if (!element) return;
      let disposed = false;
      const initialInputs = latestInputs.current;
      const renderLoading = LoadingComponent
        ? () => {
            setIsLoading(true);
            return () => {
              if (!disposed) setIsLoading(false);
            };
          }
        : undefined;
      const handle = sdk.getWidget<TInputs>(
        widgetId,
        renderLoading ? { renderLoading } : undefined,
      );
      void handle.mount(element, initialInputs).then((mounted) => {
        if (disposed) {
          void mounted.unmount();
          return;
        }
        mountedWidget.current = mounted;
        if (latestInputs.current !== initialInputs)
          mounted.setInputs?.(latestInputs.current);
      });

      return () => {
        disposed = true;
        const mounted = mountedWidget.current;
        mountedWidget.current = undefined;
        if (mounted) void mounted.unmount();
      };
    }, []);

    useEffect(() => {
      mountedWidget.current?.setInputs?.(inputs);
    }, [inputs]);

    return createElement(
      Fragment,
      undefined,
      isLoading && LoadingComponent
        ? createElement(LoadingComponent, {})
        : undefined,
      createElement('div', {
        ref: container,
        'data-atlas-widget-container': widgetId,
      }),
    );
  };
  Widget.displayName = `AtlasWidget(${widgetId})`;
  return Widget;
}
