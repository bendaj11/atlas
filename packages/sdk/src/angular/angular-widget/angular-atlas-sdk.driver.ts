import '@angular/compiler';
import { faker } from '@faker-js/faker';
import {
  signal,
  type ApplicationRef,
  type EnvironmentInjector,
} from '@angular/core';
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
  private readonly angularSdk: AngularAtlasSdk = createAngularAtlasSdk({
    sdk: this.sdk,
    applicationRef: Object.create(null) as ApplicationRef,
    environmentInjector: Object.create(null) as EnvironmentInjector,
    hostData: signal(this.sdk.hostData).asReadonly(),
  });

  constructor() {
    connectAtlasWidgetResolver(this.sdk, (widgetId) => ({
      id: widgetId,
      name: faker.commerce.productName(),
      mount: async () => ({ unmount: async () => undefined }),
    }));
  }

  readonly get = {
    binding: (widgetId: string, inputs: WidgetInputs) =>
      this.angularSdk.getWidget<WidgetInputs>(widgetId, { inputs }),
    hostData: () => this.angularSdk.hostData(),
    sdkHostData: () => this.sdk.hostData,
  };
}
