import {
  ApplicationRef,
  createComponent,
  type EnvironmentInjector,
  type Type
} from "@angular/core";
import type {
  AtlasMountedWidgetHandle,
  AtlasSdk as AtlasSdkValue,
  AtlasWidgetLoadingRenderer
} from "./host.js";

export interface AngularGetWidgetOptions<TInputs extends object> {
  containerId: string;
  inputs: TInputs;
  loadingComponent?: Type<unknown>;
}

export interface AngularWidgetRef<TInputs extends object> {
  readonly ready: Promise<void>;
  setInputs(inputs: TInputs): void;
  destroy(): Promise<void>;
}

export type AngularAtlasSdk<THostSdk extends object = {}> = Omit<AtlasSdkValue<THostSdk>, "getWidget"> & {
  getWidget<TInputs extends object>(
    widgetId: string,
    options: AngularGetWidgetOptions<TInputs>
  ): AngularWidgetRef<TInputs>;
};

interface MountAngularWidgetInput<TInputs extends object> {
  sdk: AtlasSdkValue;
  applicationRef: ApplicationRef;
  environmentInjector: EnvironmentInjector;
  widgetId: string;
  options: AngularGetWidgetOptions<TInputs>;
}

export function createAngularAtlasSdk<THostSdk extends object>(
  sdk: AtlasSdkValue<THostSdk>,
  applicationRef: ApplicationRef,
  environmentInjector: EnvironmentInjector
): AngularAtlasSdk<THostSdk> {
  const facade = Object.create(sdk) as AngularAtlasSdk<THostSdk>;
  Object.defineProperty(facade, "getWidget", {
    value: <TInputs extends object>(
      widgetId: string,
      options: AngularGetWidgetOptions<TInputs>
    ): AngularWidgetRef<TInputs> => mountWidget({ sdk, applicationRef, environmentInjector, widgetId, options })
  });
  return facade;
}

function mountWidget<TInputs extends object>(input: MountAngularWidgetInput<TInputs>): AngularWidgetRef<TInputs> {
  const { sdk, applicationRef, environmentInjector, widgetId, options } = input;
  const container = globalThis.document?.getElementById(options.containerId);
  if (!container) {
    throw new Error(`Atlas widget container "${options.containerId}" was not found. Call getWidget after the container is rendered.`);
  }

  let inputs = options.inputs;
  let mountedWidget: AtlasMountedWidgetHandle<TInputs> | undefined;
  let destroyed = false;
  let destroyPromise: Promise<void> | undefined;
  const renderLoading = options.loadingComponent
    ? createAngularLoadingRenderer(options.loadingComponent, applicationRef, environmentInjector)
    : undefined;
  const handle = sdk.getWidget<TInputs>(widgetId, renderLoading ? { renderLoading } : undefined);
  const mountedWidgetPromise = handle.mount(container, inputs);
  const ready = mountedWidgetPromise.then(async (mounted) => {
    mountedWidget = mounted;
    if (destroyed) {
      await mounted.unmount();
      return;
    }
    if (inputs !== options.inputs) mounted.setInputs?.(inputs);
  });

  return {
    ready,
    setInputs(nextInputs) {
      inputs = nextInputs;
      mountedWidget?.setInputs?.(nextInputs);
    },
    destroy() {
      if (destroyPromise) return destroyPromise;
      destroyed = true;
      destroyPromise = mountedWidget
        ? mountedWidget.unmount()
        : ready;
      return destroyPromise;
    }
  };
}

function createAngularLoadingRenderer(
  loadingComponent: Type<unknown>,
  applicationRef: ApplicationRef,
  environmentInjector: EnvironmentInjector
): AtlasWidgetLoadingRenderer {
  return (container) => {
    const hostElement = container.ownerDocument.createElement("div");
    container.append(hostElement);
    const component = createComponent(loadingComponent, { environmentInjector, hostElement });
    applicationRef.attachView(component.hostView);
    component.changeDetectorRef.detectChanges();
    return () => {
      applicationRef.detachView(component.hostView);
      component.destroy();
      hostElement.remove();
    };
  };
}
