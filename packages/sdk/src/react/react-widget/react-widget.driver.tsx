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
} from '../../core/sdk-types/sdk-types.js';
import {
  connectAtlasWidgetResolver,
  createAtlasSdk,
} from '../../core/sdk-factory/sdk-factory.js';
import {
  anAppContext,
  anAppManifest,
} from '../../testkit/app-context.testkit.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import { createReactAtlasSdk, type ReactAtlasSdk } from './react-widget.js';

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

export class ReactWidgetDriver {
  private readonly sdk = createAtlasSdk({
    hostId: faker.string.uuid(),
    navigation: aMemoryNavigation(),
  });
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
  private readonly resolver = jest.fn<AtlasGetWidget>(
    (widgetId, options) =>
      ({
        id: widgetId,
        name: faker.commerce.productName(),
        mount: this.mount,
        renderLoading: options?.renderLoading,
      }) as unknown as AtlasWidgetHandle<object>,
  );
  private reactSdk: ReactAtlasSdk = createReactAtlasSdk(this.sdk);
  private loadingComponent: ComponentType | undefined;
  private rendered: RenderResult | undefined;

  constructor() {
    connectAtlasWidgetResolver(this.sdk, this.resolver);
  }

  readonly given = {
    remoteEntryUrl: (remoteEntryUrl: string): this => {
      this.reactSdk = createReactAtlasSdk(
        this.sdk,
        anAppContext({ manifest: anAppManifest({ remoteEntryUrl }) }),
      );

      return this;
    },
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
      const Widget = this.widget(widgetId);
      this.rendered = render(
        createElement(Boundary, undefined, createElement(Widget, inputs)),
      );
      await Promise.resolve();
    },
    widgetRerendered: async (
      widgetId: string,
      inputs: WidgetInputs,
    ): Promise<void> => {
      const Widget = this.widget(widgetId);
      this.rendered?.rerender(
        createElement(Boundary, undefined, createElement(Widget, inputs)),
      );
      await Promise.resolve();
    },
    widgetUnmounted: (): void => {
      this.rendered?.unmount();
    },
    loadingShown: async (): Promise<() => void> => {
      const options = this.resolver.mock.calls[0]?.[1];
      const renderLoading =
        options?.renderLoading as AtlasWidgetLoadingRenderer;
      const hide =
        renderLoading(document.createElement('div')) ?? (() => undefined);
      await Promise.resolve();

      return hide;
    },
  };

  readonly get = {
    widget: (widgetId: string): ComponentType<WidgetInputs> =>
      this.widget(widgetId),
    reactSdk: (): ReactAtlasSdk => this.reactSdk,
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

  private widget(widgetId: string): ComponentType<WidgetInputs> {
    return this.reactSdk.getWidget<WidgetInputs>(
      widgetId,
      this.loadingComponent
        ? { loadingComponent: this.loadingComponent }
        : undefined,
    );
  }
}
