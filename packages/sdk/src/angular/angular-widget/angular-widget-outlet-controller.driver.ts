import '@angular/compiler';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import {
  signal,
  type ApplicationRef,
  type EnvironmentInjector,
} from '@angular/core';
import type {
  AtlasGetWidget,
  AtlasMountedWidgetHandle,
  AtlasWidgetHandle,
  MountWidget,
} from '../../core/sdk-types/index.js';
import {
  connectAtlasWidgetResolver,
  createAtlasSdk,
} from '../../core/sdk-factory/index.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import {
  AngularWidgetOutletController,
  createAngularAtlasSdk,
  type AngularAtlasSdk,
  type AngularWidgetBinding,
} from './index.js';

interface WidgetInputs {
  readonly count: number;
}

export class AngularWidgetOutletControllerDriver {
  private readonly sdk = createAtlasSdk({
    hostId: faker.string.uuid(),
    navigation: aMemoryNavigation(),
  });
  private readonly lifecycle: string[] = [];
  private readonly setInputs = jest.fn<(inputs: WidgetInputs) => void>();
  private readonly handleError = jest.fn<(error: unknown) => void>();
  private readonly mount = jest.fn<MountWidget<WidgetInputs>>(async () =>
    this.mountedWidget(),
  );
  private readonly resolver = jest.fn<AtlasGetWidget>(
    (widgetId) =>
      ({
        id: widgetId,
        name: faker.commerce.productName(),
        mount: (container: HTMLElement, inputs: object) => {
          this.lifecycle.push(`mount:${widgetId}`);

          return this.mount(container, inputs as WidgetInputs);
        },
      }) as AtlasWidgetHandle<object>,
  );
  private readonly angularSdk: AngularAtlasSdk = createAngularAtlasSdk({
    sdk: this.sdk,
    applicationRef: Object.create(null) as ApplicationRef,
    environmentInjector: Object.create(null) as EnvironmentInjector,
    hostData: signal(this.sdk.hostData).asReadonly(),
  });
  private readonly controller = new AngularWidgetOutletController<WidgetInputs>(
    Object.create(null) as HTMLElement,
    this.handleError,
  );
  private releaseMount: (() => void) | undefined;
  private mountStarted: Promise<void> = Promise.resolve();

  constructor() {
    connectAtlasWidgetResolver(this.sdk, this.resolver);
  }

  readonly given = {
    setInputsUnsupported: () => {
      this.mount.mockImplementation(async () => ({
        unmount: async () => undefined,
      }));

      return this;
    },
    pendingMount: () => {
      let notifyStarted: () => void = () => undefined;
      this.mountStarted = new Promise<void>((resolve) => {
        notifyStarted = resolve;
      });
      const released = new Promise<void>((resolve) => {
        this.releaseMount = resolve;
      });
      this.mount.mockImplementation(async () => {
        notifyStarted();
        await released;

        return this.mountedWidget();
      });

      return this;
    },
  };

  readonly when = {
    rendered: (widgetId: string, inputs: WidgetInputs) =>
      this.controller.render(this.binding(widgetId, inputs)),
    renderStarted: (widgetId: string, inputs: WidgetInputs) => {
      return this.controller.render(this.binding(widgetId, inputs));
    },
    mountStarted: () => this.mountStarted,
    mountReleased: () => {
      this.releaseMount?.();
    },
    destroyed: () => this.controller.destroy(),
    destroyStarted: () => this.controller.destroy(),
    foreignBindingRendered: (widgetId: string) =>
      this.controller.render({ widgetId, inputs: { count: 0 } }),
  };

  readonly get = {
    mountMock: () => this.mount,
    setInputsMock: () => this.setInputs,
    handleErrorMock: () => this.handleError,
    lifecycle: () => this.lifecycle,
  };

  private binding(
    widgetId: string,
    inputs: WidgetInputs,
  ): AngularWidgetBinding<WidgetInputs> {
    return this.angularSdk.getWidget<WidgetInputs>(widgetId, { inputs });
  }

  private mountedWidget(): AtlasMountedWidgetHandle<WidgetInputs> {
    const widgetId = this.lifecycle.at(-1)?.slice('mount:'.length);

    return {
      setInputs: this.setInputs,
      unmount: async () => {
        this.lifecycle.push(`unmount:${widgetId}`);
      },
    };
  }
}
