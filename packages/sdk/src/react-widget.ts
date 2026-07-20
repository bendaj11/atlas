import {
  Fragment,
  createElement,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type FunctionComponent
} from "react";
import type { AtlasMountedWidgetHandle, AtlasSdk as AtlasSdkValue } from "./host.js";

export interface ReactGetWidgetOptions {
  loadingComponent?: ComponentType;
}

export type ReactAtlasSdk<THostSdk extends object = {}> = Omit<AtlasSdkValue<THostSdk>, "getWidget"> & {
  getWidget<TInputs extends object>(
    widgetId: string,
    options?: ReactGetWidgetOptions
  ): ComponentType<TInputs>;
};

const sdkFacades = new WeakMap<object, ReactAtlasSdk<object>>();

export function createReactAtlasSdk<THostSdk extends object>(
  sdk: AtlasSdkValue<THostSdk>
): ReactAtlasSdk<THostSdk> {
  const cached = sdkFacades.get(sdk);
  if (cached) return cached as ReactAtlasSdk<THostSdk>;

  const widgets = new Map<string, Map<ComponentType | undefined, ComponentType<object>>>();
  const facade = Object.create(sdk) as ReactAtlasSdk<THostSdk>;
  Object.defineProperty(facade, "getWidget", {
    value: <TInputs extends object>(widgetId: string, options?: ReactGetWidgetOptions): ComponentType<TInputs> => {
      const loadingComponent = options?.loadingComponent;
      const widgetsByLoadingComponent = widgets.get(widgetId) ?? new Map();
      widgets.set(widgetId, widgetsByLoadingComponent);
      const cachedWidget = widgetsByLoadingComponent.get(loadingComponent);
      if (cachedWidget) return cachedWidget as ComponentType<TInputs>;

      const widget = createWidgetComponent<TInputs>(sdk, widgetId, loadingComponent);
      widgetsByLoadingComponent.set(loadingComponent, widget as ComponentType<object>);
      return widget;
    }
  });
  sdkFacades.set(sdk, facade as ReactAtlasSdk<object>);
  return facade;
}

function createWidgetComponent<TInputs extends object>(
  sdk: AtlasSdkValue,
  widgetId: string,
  LoadingComponent?: ComponentType
): FunctionComponent<TInputs> {
  const Widget: FunctionComponent<TInputs> = (inputs) => {
    const container = useRef<HTMLDivElement>(null);
    const mountedWidget = useRef<AtlasMountedWidgetHandle<TInputs>>();
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
            return () => { if (!disposed) setIsLoading(false); };
          }
        : undefined;
      const handle = sdk.getWidget<TInputs>(widgetId, renderLoading ? { renderLoading } : undefined);
      void handle.mount(element, initialInputs).then((mounted) => {
        if (disposed) {
          void mounted.unmount();
          return;
        }
        mountedWidget.current = mounted;
        if (latestInputs.current !== initialInputs) mounted.setInputs?.(latestInputs.current);
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
      isLoading && LoadingComponent ? createElement(LoadingComponent) : undefined,
      createElement("div", { ref: container, "data-atlas-widget-container": widgetId })
    );
  };
  Widget.displayName = `AtlasWidget(${widgetId})`;
  return Widget;
}
