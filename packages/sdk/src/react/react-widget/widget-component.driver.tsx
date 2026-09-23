import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import {
  Component,
  createElement,
  type ComponentType,
  type ReactNode,
} from 'react';
import { render, screen, type RenderResult } from '@testing-library/react';
import type {
  AtlasGetWidget,
  AtlasMountedWidgetHandle,
  AtlasWidgetLoadingRenderer,
  MountWidget,
  SetWidgetInputs,
  UnmountWidget,
} from '../../core/sdk-types/index.js';
import { createWidgetComponent } from './widget-component.js';

interface WidgetInputs {
  readonly count: number;
}

const LOADING_LABEL = 'Widget loading';
const ERROR_LABEL = 'Widget error';

function Loading() {
  return createElement('output', { 'aria-label': LOADING_LABEL }, 'loading');
}

class Boundary extends Component<{ children: ReactNode }, { error: unknown }> {
  override state = { error: undefined as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  override render() {
    return this.state.error === undefined
      ? this.props.children
      : createElement(
          'output',
          { 'aria-label': ERROR_LABEL },
          (this.state.error as { code?: string }).code,
        );
  }
}

export class WidgetComponentDriver {
  private readonly setInputs = jest.fn<SetWidgetInputs<object>>();
  private readonly unmount = jest.fn<UnmountWidget>(async () => undefined);
  private readonly mounted: AtlasMountedWidgetHandle<object> = {
    setInputs: this.setInputs,
    unmount: this.unmount,
  };
  private readonly mount = jest.fn<MountWidget<object>>(
    async () => this.mounted,
  );
  private renderLoading: AtlasWidgetLoadingRenderer | undefined;
  private readonly getWidget = jest.fn<AtlasGetWidget>((widgetId, options) => {
    this.renderLoading = options?.renderLoading;

    return {
      id: widgetId,
      name: faker.commerce.productName(),
      mount: (container, inputs) => this.mount(container, inputs),
    };
  });
  private readonly widgets = new Map<string, ComponentType<WidgetInputs>>();
  private loadingComponent: ComponentType | undefined;
  private rendered: RenderResult | undefined;
  private releaseMount: (() => void) | undefined;

  readonly given = {
    loadingComponent: (component: ComponentType | undefined): this => {
      this.loadingComponent = component ?? Loading;

      return this;
    },
    mountRejection: (error: Error): this => {
      this.mount.mockRejectedValue(error);

      return this;
    },
    pendingMount: (): this => {
      const released = new Promise<void>((resolve) => {
        this.releaseMount = resolve;
      });
      this.mount.mockImplementation(async () => {
        await released;

        return this.mounted;
      });

      return this;
    },
  };

  readonly when = {
    widgetRendered: async (
      widgetId: string,
      inputs: WidgetInputs,
    ): Promise<void> => {
      this.rendered = render(this.createWidgetElement(widgetId, inputs));
      await Promise.resolve();
    },
    widgetRerendered: async (
      widgetId: string,
      inputs: WidgetInputs,
    ): Promise<void> => {
      this.rendered?.rerender(this.createWidgetElement(widgetId, inputs));
      await Promise.resolve();
    },
    widgetUnmounted: (): void => {
      this.rendered?.unmount();
    },
    mountReleased: async (): Promise<void> => {
      this.releaseMount?.();
      await Promise.resolve();
    },
    loadingShown: async (): Promise<() => void> => {
      const renderLoading = this.renderLoading;

      if (!renderLoading)
        throw new Error('Widget was created without loading.');

      const hide =
        renderLoading(document.createElement('div')) ?? (() => undefined);
      await Promise.resolve();

      return hide;
    },
  };

  readonly get = {
    mountMock: (): jest.Mock<MountWidget<object>> => this.mount,
    setInputsMock: () => this.setInputs,
    unmountMock: (): jest.Mock<UnmountWidget> => this.unmount,
    container: (widgetId: string) =>
      document.querySelector(`[data-atlas-widget-container="${widgetId}"]`),
    loadingIndicator: () =>
      screen.queryByRole('status', { name: LOADING_LABEL }),
    errorCode: () =>
      screen.getByRole('status', { name: ERROR_LABEL }).textContent,
  };

  private createWidgetElement(
    widgetId: string,
    inputs: WidgetInputs,
  ): ReactNode {
    const Widget =
      this.widgets.get(widgetId) ??
      createWidgetComponent<WidgetInputs>({
        sdk: { getWidget: this.getWidget },
        widgetId,
        loadingComponent: this.loadingComponent,
      });
    this.widgets.set(widgetId, Widget);

    return createElement(Boundary, undefined, createElement(Widget, inputs));
  }
}
