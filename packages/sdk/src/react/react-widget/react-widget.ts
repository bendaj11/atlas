import {
  Fragment,
  createElement,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type FunctionComponent,
} from 'react';
import { errorSummary } from '@atlas/schema';
import type {
  AtlasEventMap,
  AtlasMountedWidgetHandle,
  AtlasSdk as AtlasSdkValue,
} from '../../host.js';
import {
  createAtlasAppAssetFacade,
  defineUnavailableAppAssets,
  type AtlasAppAssets,
} from '../../core/app-assets/app-assets.js';
import type { AtlasAppContext } from '../../lifecycle.js';
import { sdkError } from '../../core/sdk-error/sdk-error.js';

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
  if (!context) defineUnavailableAppAssets(facade);
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
    },
  });
  appFacades.set(facadeContext, facade);

  return facade;
}

interface CreateWidgetComponentInput {
  readonly sdk: Pick<AtlasSdkValue, 'getWidget'>;
  readonly widgetId: string;
  readonly loadingComponent: ComponentType | undefined;
}

function createWidgetComponent<TInputs extends object>(
  input: CreateWidgetComponentInput,
): FunctionComponent<TInputs> {
  const { sdk, widgetId, loadingComponent: LoadingComponent } = input;
  const Widget: FunctionComponent<TInputs> = (inputs) => {
    const container = useRef<HTMLDivElement>(null);
    const mountedWidget = useRef<AtlasMountedWidgetHandle<TInputs> | undefined>(
      undefined,
    );
    const latestInputs = useRef(inputs);
    const appliedInputs = useRef<TInputs | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(false);
    const [mountError, setMountError] = useState<unknown>(undefined);
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
      handle.mount(element, initialInputs).then(
        (mounted) => {
          if (disposed) {
            void mounted.unmount();

            return;
          }
          mountedWidget.current = mounted;
          appliedInputs.current = initialInputs;
          applyInputs(mounted, appliedInputs, latestInputs.current);
        },
        (error: unknown) => {
          if (!disposed) setMountError(widgetMountError(widgetId, error));
        },
      );

      return () => {
        disposed = true;
        const mounted = mountedWidget.current;
        mountedWidget.current = undefined;
        if (mounted) void mounted.unmount();
      };
    }, []);

    useEffect(() => {
      const mounted = mountedWidget.current;
      if (mounted) applyInputs(mounted, appliedInputs, inputs);
    }, [inputs]);

    if (mountError !== undefined) throw mountError;

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

function applyInputs<TInputs extends object>(
  mounted: AtlasMountedWidgetHandle<TInputs>,
  appliedInputs: { current: TInputs | undefined },
  inputs: TInputs,
): void {
  if (
    appliedInputs.current !== undefined &&
    shallowEqual(appliedInputs.current, inputs)
  ) {
    return;
  }
  appliedInputs.current = inputs;
  mounted.setInputs?.(inputs);
}

function shallowEqual(left: object, right: object): boolean {
  const leftKeys = Object.keys(left) as Array<keyof typeof left>;
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(right, key) &&
      Object.is(left[key], (right as Record<string, unknown>)[key]),
  );
}

function widgetMountError(widgetId: string, error: unknown): Error {
  const cause = error instanceof Error ? error : new Error(String(error));

  return sdkError(
    `Atlas widget "${widgetId}" failed to mount: ${errorSummary(cause.message)}`,
    {
      suggestedActions: [
        'Check that the widget id exists in the host catalog and that its owner app is deployed.',
        'Wrap the widget in an error boundary to render a fallback while the owner app is unavailable.',
      ],
      cause,
      code: 'ATLAS_WIDGET_MOUNT_FAILED',
    },
  );
}
