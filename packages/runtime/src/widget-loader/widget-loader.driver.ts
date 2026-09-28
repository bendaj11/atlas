import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasManifest } from '@atlas/schema';
import type {
  AtlasMountedWidgetHandle,
  AtlasWidgetLoadingRenderer,
} from '@atlas/sdk/host';
import type {
  AtlasExportedWidgetEntry,
  AtlasExportedWidgetMountRequest,
  AtlasMountedWidget,
  AtlasWidgetLoader,
} from '@atlas/sdk/lifecycle';
import { createTestHostSdk } from '@atlas/testkit/internal';
import { createWidgetLoader } from './widget-loader.js';
import type {
  AtlasWidgetImporter,
  AtlasWidgetResolver,
  DisposeRenderer,
  RenderWidgetError,
  RenderWidgetLoading,
  RetryWidgetMount,
} from './widget-loader.types.js';

type WidgetProps = Record<string, unknown>;

export class WidgetLoaderDriver {
  private readonly hostId = faker.string.uuid();
  private readonly sdk = createTestHostSdk(this.hostId);
  private manifests: AtlasManifest[] = [];
  private resolveWidget: AtlasWidgetResolver | undefined;
  private readonly requests: AtlasExportedWidgetMountRequest[] = [];
  private readonly setInputs = jest.fn<(inputs: WidgetProps) => void>();
  private readonly entryUnmount = jest.fn<() => void>();
  private readonly importWidget = jest.fn<AtlasWidgetImporter>(async () =>
    this.entry(),
  );
  private readonly disposeLoading = jest.fn<DisposeRenderer>();
  private readonly disposeError = jest.fn<DisposeRenderer>();
  private readonly renderWidgetLoading = jest
    .fn<RenderWidgetLoading>()
    .mockReturnValue(this.disposeLoading);
  private readonly renderWidgetError = jest
    .fn<RenderWidgetError>()
    .mockImplementation((_container, _context, retry) => {
      this.retry = retry;

      return this.disposeError;
    });
  private readonly warn = jest
    .spyOn(console, 'warn')
    .mockImplementation(() => undefined);
  private useHostLoadingRenderer = false;
  private useHostErrorRenderer = false;
  private loader: AtlasWidgetLoader | undefined;
  private mounted: AtlasMountedWidget<WidgetProps> | undefined;
  private mountedHandle: AtlasMountedWidgetHandle<WidgetProps> | undefined;
  private container: HTMLElement | undefined;
  private retry: RetryWidgetMount | undefined;
  private entryBehavior: (request: AtlasExportedWidgetMountRequest) => void =
    () => undefined;

  constructor() {
    this.warn.mockClear();
  }

  readonly given = {
    manifests: (manifests: AtlasManifest[]) => {
      this.manifests = manifests;

      return this;
    },
    resolveWidget: (resolveWidget: AtlasWidgetResolver) => {
      this.resolveWidget = resolveWidget;

      return this;
    },
    importResults: (results: Array<AtlasExportedWidgetEntry | Error>) => {
      for (const result of results) {
        if (result instanceof Error)
          this.importWidget.mockRejectedValueOnce(result);
        else this.importWidget.mockResolvedValueOnce(result);
      }

      return this;
    },
    importDelayed: () => {
      this.importWidget.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));

        return this.entry();
      });

      return this;
    },
    hostLoadingRenderer: () => {
      this.useHostLoadingRenderer = true;

      return this;
    },
    hostErrorRenderer: () => {
      this.useHostErrorRenderer = true;

      return this;
    },
    entryBehavior: (
      behavior: (request: AtlasExportedWidgetMountRequest) => void,
    ) => {
      this.entryBehavior = behavior;

      return this;
    },
  };

  readonly when = {
    created: () => {
      this.loader = createWidgetLoader({
        manifests: this.manifests,
        sdk: this.sdk,
        options: {
          importWidget: this.importWidget,
          ...(this.resolveWidget ? { resolveWidget: this.resolveWidget } : {}),
          ...(this.useHostLoadingRenderer
            ? { renderWidgetLoading: this.renderWidgetLoading }
            : {}),
          ...(this.useHostErrorRenderer
            ? { renderWidgetError: this.renderWidgetError }
            : {}),
        },
      });
    },
    mounted: async (widgetId: string, props: WidgetProps = {}) => {
      this.container = document.body.appendChild(document.createElement('div'));
      this.mounted = await this.loader!.mount(widgetId, this.container, props);
    },
    mountedTwiceConcurrently: async (widgetId: string) => {
      await Promise.all([
        this.loader!.mount(
          widgetId,
          document.body.appendChild(document.createElement('div')),
          {},
        ),
        this.loader!.mount(
          widgetId,
          document.body.appendChild(document.createElement('div')),
          {},
        ),
      ]);
    },
    mountedThroughHandle: async (
      widgetId: string,
      renderLoading: AtlasWidgetLoadingRenderer,
    ) => {
      this.container = document.body.appendChild(document.createElement('div'));
      this.mountedHandle = await this.loader!.getWidget(widgetId, {
        renderLoading,
      }).mount(this.container, {});
    },
    inputsSet: (inputs: WidgetProps) => this.mounted!.setInputs?.(inputs),
    timeElapsed: (milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
    retried: async () => {
      this.retry!();

      await new Promise((resolve) => setTimeout(resolve, 0));
    },
    unmounted: () => (this.mounted ?? this.mountedHandle)!.unmount(),
  };

  readonly get = {
    hostId: () => this.hostId,
    listed: (ownerAppId?: string) => this.loader!.list(ownerAppId),
    handleName: (widgetId: string) => this.loader!.getWidget(widgetId).name,
    mountedWidget: () => this.mounted!.widget,
    lastRequest: () => this.requests.at(-1)!,
    requests: () => this.requests,
    container: () => this.container!,
    loader: () => this.container!.querySelector('[data-atlas-loader]'),
    alert: () => this.container!.querySelector('[role="alert"]'),
    boundaryDisplay: () =>
      this.container!.querySelector<HTMLElement>('[data-atlas-widget]')?.style
        .display,
    importWidgetMock: () => this.importWidget,
    setInputsMock: () => this.setInputs,
    entryUnmountMock: () => this.entryUnmount,
    renderWidgetLoadingMock: () => this.renderWidgetLoading,
    renderWidgetErrorMock: () => this.renderWidgetError,
    disposeLoadingMock: () => this.disposeLoading,
    disposeErrorMock: () => this.disposeError,
    warnMock: () => this.warn,
  };

  private entry(): AtlasExportedWidgetEntry {
    return {
      mount: (request) => {
        this.requests.push(request);
        this.entryBehavior(request);

        return { setInputs: this.setInputs, unmount: this.entryUnmount };
      },
    };
  }
}
