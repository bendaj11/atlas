import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type {
  AtlasAppMountRequest,
  AtlasAppMountResult,
  AtlasExportedWidgetMountRequest,
  AtlasExportedWidgetMountResult,
} from '../../lifecycle.js';
import { createAtlasSdk } from '../../core/sdk-factory/sdk-factory.js';
import {
  anAppContext,
  anExportedWidgetManifest,
} from '../../testkit/app-context.testkit.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import type { AppRouterLike } from '../react-router/react-router.js';
import {
  createRoutedApp,
  defineApp,
  defineExportedWidget,
  type RootAdapter,
} from './react-app.js';

interface WidgetProps {
  readonly count: number;
}

export class ReactAppDriver {
  private readonly render = jest.fn<RootAdapter['render']>();
  private readonly unmountRoot = jest.fn<RootAdapter['unmount']>();
  private readonly createRoot = jest.fn<
    (container: HTMLElement) => RootAdapter
  >(() => ({ render: this.render, unmount: this.unmountRoot }));
  private readonly createElement = jest.fn<
    (request: AtlasAppMountRequest) => unknown
  >(() => faker.lorem.word());
  private readonly createWidgetElement = jest.fn<
    (request: AtlasExportedWidgetMountRequest<WidgetProps>) => unknown
  >((request) => request.props);
  private readonly routerUnsubscribe = jest.fn<() => void>();
  private readonly routerDispose = jest.fn<() => void>();
  private readonly router: AppRouterLike = {
    state: { location: { pathname: '/' } },
    navigate: () => undefined,
    subscribe: () => this.routerUnsubscribe,
    dispose: this.routerDispose,
  };
  private readonly context = anAppContext();
  private readonly sdk = createAtlasSdk({
    hostId: faker.string.uuid(),
    navigation: aMemoryNavigation(),
  });
  private readonly container = {} as HTMLElement;
  private mounted: AtlasAppMountResult | void = undefined;
  private mountedWidget: AtlasExportedWidgetMountResult<WidgetProps> | void =
    undefined;

  readonly when = {
    appMounted: async (): Promise<void> => {
      this.mounted = await defineApp({
        createRoot: this.createRoot,
        createElement: this.createElement,
      }).mount(this.mountRequest());
    },
    routedAppMounted: async (): Promise<void> => {
      this.mounted = await createRoutedApp({
        createRoot: this.createRoot,
        createRouter: () => this.router,
        createElement: (_router, request) => this.createElement(request),
      }).mount(this.mountRequest());
    },
    widgetMounted: async (props: WidgetProps): Promise<void> => {
      this.mountedWidget = await defineExportedWidget<WidgetProps>({
        createRoot: this.createRoot,
        createElement: this.createWidgetElement,
      }).mount({
        ...this.mountRequest(),
        props,
        widget: anExportedWidgetManifest({
          ownerAppId: this.context.manifest.id,
        }),
        ownerManifest: this.context.manifest,
      });
    },
    unmounted: async (): Promise<void> => {
      await this.mounted?.unmount?.();
      await this.mountedWidget?.unmount?.();
    },
    widgetInputsSet: (props: WidgetProps): void => {
      this.mountedWidget?.setInputs?.(props);
    },
  };

  readonly get = {
    createRootMock: (): jest.Mock<(container: HTMLElement) => RootAdapter> =>
      this.createRoot,
    renderMock: (): jest.Mock<RootAdapter['render']> => this.render,
    unmountRootMock: (): jest.Mock<RootAdapter['unmount']> => this.unmountRoot,
    createElementMock: (): jest.Mock<
      (request: AtlasAppMountRequest) => unknown
    > => this.createElement,
    createWidgetElementMock: (): jest.Mock<
      (request: AtlasExportedWidgetMountRequest<WidgetProps>) => unknown
    > => this.createWidgetElement,
    routerUnsubscribeMock: (): jest.Mock<() => void> => this.routerUnsubscribe,
    routerDisposeMock: (): jest.Mock<() => void> => this.routerDispose,
    container: (): HTMLElement => this.container,
    context: () => this.context,
  };

  private mountRequest(): AtlasAppMountRequest {
    return {
      container: this.container,
      styleTarget: this.container as unknown as Node & ParentNode,
      sdk: this.sdk,
      context: this.context,
    };
  }
}
