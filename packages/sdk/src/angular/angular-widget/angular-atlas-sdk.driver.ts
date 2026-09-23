import '@angular/compiler';
import { faker } from '@faker-js/faker';
import {
  provideZonelessChangeDetection,
  signal,
  type ApplicationRef,
} from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import {
  connectAtlasWidgetResolver,
  createAtlasSdk,
} from '../../core/sdk-factory/index.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import { createAngularAtlasSdk } from './angular-atlas-sdk.js';
import type { AngularAtlasSdk } from './angular-widget.types.js';

interface WidgetInputs {
  readonly count: number;
}

export class AngularAtlasSdkDriver {
  private readonly sdk = createAtlasSdk({
    hostId: faker.string.uuid(),
    navigation: aMemoryNavigation(),
  });
  private applicationRef!: ApplicationRef;
  private angularSdk!: AngularAtlasSdk;

  constructor() {
    connectAtlasWidgetResolver(this.sdk, (widgetId) => ({
      id: widgetId,
      name: faker.commerce.productName(),
      mount: async () => ({ unmount: async () => undefined }),
    }));
  }

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
    applicationDestroyed: (): void => {
      this.applicationRef.destroy();
    },
  };

  readonly get = {
    binding: (widgetId: string, inputs: WidgetInputs) =>
      this.angularSdk.getWidget<WidgetInputs>(widgetId, { inputs }),
    hostData: () => this.angularSdk.hostData(),
    sdkHostData: () => this.sdk.hostData,
  };
}
