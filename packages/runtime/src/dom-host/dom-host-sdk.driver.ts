import { faker } from '@faker-js/faker';
import { aHostRuntimeConfig, createMemoryNavigation } from '@atlas/testkit';
import { aFederationAdapter } from '../loader/native-federation.testkit.js';
import { createDomHostSdk } from './dom-host-sdk.js';
import type { DomHostSdk } from './dom-host-sdk.types.js';
import type { DomHostOptions } from './dom-host.types.js';
import { AtlasHostAnchorRegistry } from './host-anchors.js';

export interface ProductSdk {
  hostData: { region: string };
  greet(): string;
}

export class DomHostSdkDriver {
  private readonly hostId = faker.string.uuid();
  private readonly runtimeConfig = aHostRuntimeConfig({ hostId: this.hostId });
  private options: DomHostOptions<ProductSdk> = {
    federation: aFederationAdapter(),
    runtimeConfig: this.runtimeConfig,
    anchors: new AtlasHostAnchorRegistry(),
    hostData: { region: faker.location.countryCode() },
    greet: () => '',
  };
  private sdk: DomHostSdk<ProductSdk> | undefined;

  readonly given = {
    options: (options: Partial<DomHostOptions<ProductSdk>>) => {
      this.options = { ...this.options, ...options };

      return this;
    },
  };

  readonly when = {
    created: () => {
      this.sdk = createDomHostSdk<ProductSdk>({
        options: this.options,
        hostId: this.hostId,
        navigation: createMemoryNavigation(),
      });
    },
  };

  readonly get = {
    sdkKeys: () => Object.keys(this.sdk!),
    sdk: () => this.sdk!,
  };
}
