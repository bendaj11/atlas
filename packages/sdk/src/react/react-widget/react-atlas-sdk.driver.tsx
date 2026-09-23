import { faker } from '@faker-js/faker';
import {
  connectAtlasWidgetResolver,
  createAtlasSdk,
} from '../../core/sdk-factory/index.js';
import {
  anAppContext,
  anAppManifest,
} from '../../testkit/app-context.testkit.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import { createReactAtlasSdk } from './react-atlas-sdk.js';
import type { ReactAtlasSdk } from './react-widget.types.js';

export class ReactAtlasSdkDriver {
  private readonly sdk = createAtlasSdk({
    hostId: faker.string.uuid(),
    navigation: aMemoryNavigation(),
  });
  private reactSdk: ReactAtlasSdk = createReactAtlasSdk(this.sdk);

  constructor() {
    connectAtlasWidgetResolver(this.sdk, (widgetId) => ({
      id: widgetId,
      name: faker.commerce.productName(),
      mount: async () => ({ unmount: async () => undefined }),
    }));
  }

  readonly given = {
    remoteEntryUrl: (remoteEntryUrl: string) => {
      this.reactSdk = createReactAtlasSdk(
        this.sdk,
        anAppContext({ manifest: anAppManifest({ remoteEntryUrl }) }),
      );

      return this;
    },
  };

  readonly get = {
    widget: (widgetId: string) => this.reactSdk.getWidget<object>(widgetId),
    reactSdk: () => this.reactSdk,
  };
}
