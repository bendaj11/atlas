import type { AtlasMountedWidgetHandle } from '../../host.js';
import { widgetRuntimeOf } from './angular-widget-binding.js';
import type {
  MountedWidgetRecord,
  AngularWidgetBinding,
  WidgetBindingRuntime,
  WidgetErrorHandler,
} from './angular-widget.types.js';

/** Serializes mount, input updates, and unmount of one widget inside a container. */
export class AngularWidgetOutletController<TInputs extends object> {
  private updateQueue = Promise.resolve();
  private activeWidget: MountedWidgetRecord | undefined;
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

    const runtime = widgetRuntimeOf(binding);
    const updatableWidget = this.mountedWidgetReusableFor(runtime);

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

  private mountedWidgetReusableFor(
    runtime: WidgetBindingRuntime,
  ): AtlasMountedWidgetHandle<object> | undefined {
    if (this.activeWidget?.widgetId !== runtime.widgetId) return undefined;

    if (this.activeWidget.loadingComponent !== runtime.loadingComponent) {
      return undefined;
    }

    return this.activeWidget.mounted;
  }

  private async unmountActiveWidget(): Promise<void> {
    const activeWidget = this.activeWidget;
    this.activeWidget = undefined;

    await activeWidget?.mounted.unmount();
  }
}
