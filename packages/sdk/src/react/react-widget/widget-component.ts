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
  AtlasMountedWidgetHandle,
  AtlasSdk as AtlasSdkValue,
} from '../../host.js';
import { forwardChangedInputs } from './widget-inputs.js';
import { AtlasWidgetMountError } from '../../core/sdk-error/sdk-error.js';

export interface CreateWidgetComponentInput {
  readonly sdk: Pick<AtlasSdkValue, 'getWidget'>;
  readonly widgetId: string;
  readonly loadingComponent: ComponentType | undefined;
}

/** Builds the React component that mounts one host widget into its own container. */
export function createWidgetComponent<TInputs extends object>(
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
          forwardChangedInputs(mounted, appliedInputs, latestInputs.current);
        },
        (error: unknown) => {
          if (!disposed)
            setMountError(new AtlasWidgetMountError(widgetId, error));
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

      if (mounted) forwardChangedInputs(mounted, appliedInputs, inputs);
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
