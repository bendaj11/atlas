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
  AtlasWidgetHandle,
  AtlasWidgetLoadingRenderer,
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
  private readonly setInputs = jest.fn<(inputs: WidgetInputs) => void>();
  private readonly unmount = jest.fn<() => Promise<void>>(
    async () => undefined,
  );
  private readonly mounted: AtlasMountedWidgetHandle<WidgetInputs> = {
    setInputs: this.setInputs,
    unmount: this.unmount,
  };
  private readonly mount = jest.fn<AtlasWidgetHandle<WidgetInputs>['mount']>(
    async () => this.mounted,
  );
  private readonly getWidget = jest.fn<AtlasGetWidget>(
    (widgetId, options) =>
      ({
        id: widgetId,
        name: faker.commerce.productName(),
        mount: this.mount,
        renderLoading: options?.renderLoading,
      }) as unknown as AtlasWidgetHandle<object>,
  );
  private readonly widgets = new Map<string, ComponentType<WidgetInputs>>();
  private loadingComponent: ComponentType | undefined;
  private rendered: RenderResult | undefined;

  readonly given = {
    loadingComponent: (component: ComponentType | undefined): this => {
      this.loadingComponent = component ?? Loading;

      return this;
    },
    mountRejection: (error: Error): this => {
      this.mount.mockRejectedValue(error);

      return this;
    },
  };

  readonly when = {
    widgetRendered: async (
      widgetId: string,
      inputs: WidgetInputs,
    ): Promise<void> => {
      this.rendered = render(this.element(widgetId, inputs));
      await Promise.resolve();
    },
    widgetRerendered: async (
      widgetId: string,
      inputs: WidgetInputs,
    ): Promise<void> => {
      this.rendered?.rerender(this.element(widgetId, inputs));
      await Promise.resolve();
    },
    widgetUnmounted: (): void => {
      this.rendered?.unmount();
    },
    loadingShown: async (): Promise<() => void> => {
      const options = this.getWidget.mock.calls[0]?.[1];
      const renderLoading =
        options?.renderLoading as AtlasWidgetLoadingRenderer;
      const hide =
        renderLoading(document.createElement('div')) ?? (() => undefined);
      await Promise.resolve();

      return hide;
    },
  };

  readonly get = {
    mountMock: (): jest.Mock<AtlasWidgetHandle<WidgetInputs>['mount']> =>
      this.mount,
    setInputsMock: (): jest.Mock<(inputs: WidgetInputs) => void> =>
      this.setInputs,
    unmountMock: (): jest.Mock<() => Promise<void>> => this.unmount,
    container: (widgetId: string): HTMLElement | null =>
      document.querySelector(`[data-atlas-widget-container="${widgetId}"]`),
    loadingIndicator: (): HTMLElement | null =>
      screen.queryByRole('status', { name: LOADING_LABEL }),
    errorCode: (): string | null =>
      screen.getByRole('status', { name: ERROR_LABEL }).textContent,
  };

  private element(widgetId: string, inputs: WidgetInputs): ReactNode {
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
