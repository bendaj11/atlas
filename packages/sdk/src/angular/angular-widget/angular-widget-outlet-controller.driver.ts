import '@angular/compiler';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import {
  Component,
  provideZonelessChangeDetection,
  signal,
  type ApplicationRef,
} from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import type {
  AtlasGetWidget,
  AtlasMountedWidgetHandle,
  MountWidget,
  SetWidgetInputs,
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

@Component({
  selector: 'atlas-widget-skeleton',
  standalone: true,
  template: '<output aria-label="Widget loading">loading</output>',
})
class WidgetSkeleton {}

interface WidgetInputs {
  readonly count: number;
}

type HandleWidgetError = (error: unknown) => void;

export class AngularWidgetOutletControllerDriver {
  private readonly sdk = createAtlasSdk({
    hostId: faker.string.uuid(),
    navigation: aMemoryNavigation(),
  });
  private readonly lifecycle: string[] = [];
  private readonly setInputs = jest.fn<SetWidgetInputs<object>>();
  private releaseUnmount: (() => void) | undefined;
  private unmountStarted: Promise<void> = Promise.resolve();
  private readonly handleError = jest.fn<HandleWidgetError>();
  private readonly mount = jest.fn<MountWidget<object>>(async () =>
    this.createMountedWidget(),
  );
  private readonly resolver = jest.fn<AtlasGetWidget>((widgetId) => ({
    id: widgetId,
    name: faker.commerce.productName(),
    mount: (container, inputs) => {
      this.lifecycle.push(`mount:${widgetId}`);

      return this.mount(container, inputs);
    },
  }));
  private readonly container = document.createElement('div');
  private readonly controller = new AngularWidgetOutletController<WidgetInputs>(
    this.container,
    this.handleError,
  );
  private applicationRef!: ApplicationRef;
  private angularSdk!: AngularAtlasSdk;
  private releaseMount: (() => void) | undefined;
  private mountStarted: Promise<void> = Promise.resolve();
  private blockUnmount: Promise<void> | undefined;
  private notifyUnmountStarted: (() => void) | undefined;

  constructor() {
    connectAtlasWidgetResolver(this.sdk, this.resolver);
  }

  readonly given = {
    setInputsUnsupported: (): this => {
      this.mount.mockImplementation(async () => ({
        unmount: async () => undefined,
      }));

      return this;
    },
    pendingUnmount: (): this => {
      let notifyStarted: () => void = () => undefined;
      this.unmountStarted = new Promise<void>((resolve) => {
        notifyStarted = resolve;
      });
      this.blockUnmount = new Promise<void>((resolve) => {
        this.releaseUnmount = resolve;
      });
      this.notifyUnmountStarted = notifyStarted;

      return this;
    },
    pendingMount: (): this => {
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

        return this.createMountedWidget();
      });

      return this;
    },
  };

  readonly when = {
    angularApplicationStarted: async (): Promise<void> => {
      const application = await createApplication({
        providers: [provideZonelessChangeDetection()],
      });
      this.applicationRef = application;
      this.angularSdk = createAngularAtlasSdk({
        sdk: this.sdk,
        applicationRef: application,
        environmentInjector: application.injector,
        hostData: signal(this.sdk.hostData).asReadonly(),
      });
    },
    rendered: async (widgetId: string, inputs: WidgetInputs): Promise<void> => {
      await this.controller.render(this.createBinding(widgetId, inputs));
    },
    renderedWithLoadingComponent: async (
      widgetId: string,
      inputs: WidgetInputs,
    ): Promise<void> => {
      await this.controller.render(
        this.angularSdk.getWidget<WidgetInputs>(widgetId, {
          inputs,
          loadingComponent: WidgetSkeleton,
        }),
      );
    },
    renderStarted: (widgetId: string, inputs: WidgetInputs): Promise<void> => {
      return this.controller.render(this.createBinding(widgetId, inputs));
    },
    mountStarted: (): Promise<void> => this.mountStarted,
    unmountStarted: (): Promise<void> => this.unmountStarted,
    unmountReleased: (): void => {
      this.releaseUnmount?.();
    },
    mountReleased: (): void => {
      this.releaseMount?.();
    },
    destroyed: async (): Promise<void> => {
      await this.controller.destroy();
    },
    destroyStarted: (): Promise<void> => this.controller.destroy(),
    foreignBindingRendered: (widgetId: string) =>
      this.controller.render({ widgetId, inputs: { count: 0 } }),
    applicationDestroyed: (): void => {
      this.applicationRef.destroy();
    },
  };

  readonly get = {
    mountMock: (): jest.Mock<MountWidget<object>> => this.mount,
    setInputsMock: () => this.setInputs,
    handleErrorMock: () => this.handleError,
    resolverMock: (): jest.Mock<AtlasGetWidget> => this.resolver,
    lifecycle: (): readonly string[] => this.lifecycle,
  };

  private createBinding(
    widgetId: string,
    inputs: WidgetInputs,
  ): AngularWidgetBinding<WidgetInputs> {
    return this.angularSdk.getWidget<WidgetInputs>(widgetId, { inputs });
  }

  private createMountedWidget(): AtlasMountedWidgetHandle<object> {
    const widgetId = this.lifecycle.at(-1)?.slice('mount:'.length);

    return {
      setInputs: this.setInputs,
      unmount: async () => {
        this.notifyUnmountStarted?.();
        await this.blockUnmount;
        this.lifecycle.push(`unmount:${widgetId}`);
      },
    };
  }
}
