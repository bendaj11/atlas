import {
  ApplicationRef,
  Directive,
  DestroyRef,
  effect,
  ElementRef,
  ErrorHandler,
  inject,
  input,
  createComponent,
  type EnvironmentInjector,
  type Signal,
  type Type,
} from '@angular/core';
import type {
  AtlasEventMap,
  AtlasHostDataValue,
  AtlasMountedWidgetHandle,
  AtlasSdk as AtlasSdkValue,
  AtlasWidgetHandle,
  AtlasWidgetLoadingRenderer,
} from './host.js';
import { sdkError } from './sdk-error.js';

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
> = Omit<AtlasSdkValue<THostSdk, TEvents>, 'getWidget' | 'hostData'> & {
  /** Live, host-owned data. Call it to read the current immutable snapshot. */
  readonly hostData: Signal<AtlasHostDataValue<THostSdk>>;
  getWidget<TInputs extends object>(
    widgetId: string,
    options: AngularGetWidgetOptions<TInputs>,
  ): AngularWidgetBinding<TInputs>;
};

interface AngularWidgetRuntime {
  readonly widgetId: string;
  readonly handle: AtlasWidgetHandle<object>;
  readonly loadingComponent?: Type<unknown>;
}

interface ActiveWidget {
  readonly widgetId: string;
  readonly loadingComponent?: Type<unknown>;
  readonly mounted: AtlasMountedWidgetHandle<object>;
}

const widgetRuntimes = new WeakMap<object, AngularWidgetRuntime>();

type WidgetErrorHandler = (error: unknown) => void;

export function createAngularAtlasSdk<
  THostSdk extends object,
  TEvents extends object,
>(
  sdk: AtlasSdkValue<THostSdk, TEvents>,
  applicationRef: ApplicationRef,
  environmentInjector: EnvironmentInjector,
  hostData: Signal<AtlasHostDataValue<THostSdk>>,
): AngularAtlasSdk<THostSdk, TEvents> {
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

interface CreateWidgetBindingInput<TInputs extends object> {
  readonly sdk: Pick<AtlasSdkValue, 'getWidget'>;
  readonly applicationRef: ApplicationRef;
  readonly environmentInjector: EnvironmentInjector;
  readonly widgetId: string;
  readonly options: AngularGetWidgetOptions<TInputs>;
}

function createWidgetBinding<TInputs extends object>(
  input: CreateWidgetBindingInput<TInputs>,
): AngularWidgetBinding<TInputs> {
  const renderLoading = input.options.loadingComponent
    ? createAngularLoadingRenderer(
        input.options.loadingComponent,
        input.applicationRef,
        input.environmentInjector,
      )
    : undefined;
  const handle = input.sdk.getWidget<object>(
    input.widgetId,
    renderLoading ? { renderLoading } : undefined,
  );
  const binding: AngularWidgetBinding<TInputs> = Object.freeze({
    widgetId: input.widgetId,
    inputs: input.options.inputs,
  });
  widgetRuntimes.set(binding, {
    widgetId: input.widgetId,
    handle,
    ...(input.options.loadingComponent
      ? { loadingComponent: input.options.loadingComponent }
      : {}),
  });
  return binding;
}

@Directive({ selector: '[atlasWidget]', standalone: true })
export class WidgetOutlet<TInputs extends object> {
  readonly atlasWidget = input.required<AngularWidgetBinding<TInputs>>();

  private readonly container =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly controller = new AngularWidgetOutletController<TInputs>(
    this.container,
    (error) => this.errorHandler.handleError(error),
  );

  constructor() {
    effect(() => {
      void this.controller.render(this.atlasWidget());
    });
    this.destroyRef.onDestroy(() => {
      void this.controller.destroy();
    });
  }
}

export class AngularWidgetOutletController<TInputs extends object> {
  private updateQueue = Promise.resolve();
  private activeWidget: ActiveWidget | undefined;
  private destroyed = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly handleError: WidgetErrorHandler,
  ) {}

  render(binding: AngularWidgetBinding<TInputs>): Promise<void> {
    return this.enqueueUpdate(() => this.applyBinding(binding));
  }

  destroy(): Promise<void> {
    this.destroyed = true;
    return this.enqueueUpdate(() => this.unmountActiveWidget());
  }

  private enqueueUpdate(update: () => Promise<void>): Promise<void> {
    this.updateQueue = this.updateQueue.then(update, update);
    void this.updateQueue.catch(this.handleError);
    return this.updateQueue;
  }

  private async applyBinding(
    binding: AngularWidgetBinding<TInputs>,
  ): Promise<void> {
    if (this.destroyed) return;
    const runtime = readWidgetRuntime(binding);
    const updatableWidget = this.getUpdatableWidget(runtime);
    if (updatableWidget?.setInputs) {
      updatableWidget.setInputs(binding.inputs);
      return;
    }

    await this.unmountActiveWidget();
    if (this.destroyed) return;
    const mounted = await runtime.handle.mount(this.container, binding.inputs);
    if (this.destroyed) {
      await mounted.unmount();
      return;
    }
    this.activeWidget = {
      widgetId: binding.widgetId,
      ...(runtime.loadingComponent
        ? { loadingComponent: runtime.loadingComponent }
        : {}),
      mounted,
    };
  }

  private getUpdatableWidget(
    runtime: AngularWidgetRuntime,
  ): AtlasMountedWidgetHandle<object> | undefined {
    if (this.activeWidget?.widgetId !== runtime.widgetId) return undefined;
    if (this.activeWidget.loadingComponent !== runtime.loadingComponent)
      return undefined;
    return this.activeWidget.mounted;
  }

  private async unmountActiveWidget(): Promise<void> {
    const activeWidget = this.activeWidget;
    this.activeWidget = undefined;
    await activeWidget?.mounted.unmount();
  }
}

function readWidgetRuntime(
  binding: AngularWidgetBinding<object>,
): AngularWidgetRuntime {
  const runtime = widgetRuntimes.get(binding);
  if (runtime) return runtime;
  throw sdkError(
    `Atlas cannot render widget "${binding.widgetId}" because its Angular binding was not created by sdk.getWidget().`,
    {
      suggestedActions:
        'Create the binding with the injected Angular Atlas SDK, then pass it to [atlasWidget].',
      code: 'ATLAS_WIDGET_BINDING_INVALID',
    },
  );
}

function createAngularLoadingRenderer(
  loadingComponent: Type<unknown>,
  applicationRef: ApplicationRef,
  environmentInjector: EnvironmentInjector,
): AtlasWidgetLoadingRenderer {
  return (container) => {
    const hostElement = container.ownerDocument.createElement('div');
    container.append(hostElement);
    const component = createComponent(loadingComponent, {
      environmentInjector,
      hostElement,
    });
    applicationRef.attachView(component.hostView);
    component.changeDetectorRef.detectChanges();
    return () => {
      applicationRef.detachView(component.hostView);
      component.destroy();
      hostElement.remove();
    };
  };
}
