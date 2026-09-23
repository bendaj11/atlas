import '@angular/compiler';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type {
  AtlasAppMountRequest,
  AtlasAppMountResult,
  AtlasExportedWidgetMountRequest,
} from '../../lifecycle.js';
import { createAtlasSdk } from '../../core/sdk-factory/index.js';
import {
  anAppContext,
  anExportedWidgetManifest,
} from '../../testkit/app-context.testkit.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import { defineApp, defineExportedWidget } from './define-app.js';

interface WidgetProps {
  readonly count: number;
}

type BootstrapApp = (
  request: AtlasAppMountRequest,
) => Promise<AtlasAppMountResult>;

type BootstrapWidget = (
  request: AtlasExportedWidgetMountRequest<WidgetProps>,
) => Promise<AtlasAppMountResult>;

export class DefineAngularAppDriver {
  private readonly unmount = jest.fn<() => void>();
  private readonly bootstrapApp = jest.fn<BootstrapApp>(async () => ({
    unmount: this.unmount,
  }));
  private readonly bootstrapWidget = jest.fn<BootstrapWidget>(async () => ({
    unmount: this.unmount,
  }));
  private readonly container = document.createElement('div');
  private readonly context = anAppContext();
  private readonly sdk = createAtlasSdk({
    hostId: faker.string.uuid(),
    navigation: aMemoryNavigation(),
  });
  private mounted: AtlasAppMountResult | void = undefined;

  readonly when = {
    appMounted: async (): Promise<void> => {
      this.mounted = await defineApp(this.bootstrapApp).mount(
        this.mountRequest(),
      );
    },
    widgetMounted: async (props: WidgetProps): Promise<void> => {
      this.mounted = await defineExportedWidget<WidgetProps>(
        this.bootstrapWidget,
      ).mount({
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
    },
  };

  readonly get = {
    bootstrapAppMock: () => this.bootstrapApp,
    bootstrapWidgetMock: () => this.bootstrapWidget,
    unmountMock: () => this.unmount,
    context: () => this.context,
  };

  private mountRequest(): AtlasAppMountRequest {
    return {
      container: this.container,
      styleTarget: this.container,
      sdk: this.sdk,
      context: this.context,
    };
  }
}
