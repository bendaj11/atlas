import '@angular/compiler';
import {
  createEnvironmentInjector,
  runInInjectionContext,
  ApplicationRef,
  type EnvironmentInjector,
} from '@angular/core';
import {
  injectAtlasSdk,
  provideAtlasSdk,
  type AtlasSdk as AngularAtlasSdk,
} from './angular-injection.js';
import { updateAtlasHostData } from './host-data.js';
import { createAtlasSdk } from './sdk-factory.js';
import type { AtlasSdk as AtlasSdkValue } from './sdk-types.js';
import type { AtlasNavigation } from './navigation-types.js';

interface CustomerHostSdk {
  readonly hostData: {
    readonly userName: string;
  };
}

export class AngularInjectionDriver {
  private sdk: AtlasSdkValue<CustomerHostSdk> | undefined;
  private atlas: AngularAtlasSdk<CustomerHostSdk> | undefined;
  private injector: EnvironmentInjector | undefined;

  given = {
    hostData: (userName: string): AngularInjectionDriver => {
      this.sdk = createAtlasSdk<CustomerHostSdk>({
        hostId: 'host',
        hostData: { userName },
        navigation: createNavigation(),
      });
      this.injector = createEnvironmentInjector(
        [
          provideAtlasSdk(this.sdk),
          { provide: ApplicationRef, useValue: Object.create(null) },
        ],
        null!,
      );
      this.atlas = runInInjectionContext(this.injector, () =>
        injectAtlasSdk<CustomerHostSdk>(),
      );
      return this;
    },
  };

  when = {
    hostDataChanges: (userName: string): AngularInjectionDriver => {
      updateAtlasHostData(this.getSdk(), { userName });
      return this;
    },
  };

  get = {
    userName: (): string => this.getAtlas().hostData().userName,
  };

  destroy(): void {
    this.injector?.destroy();
  }

  private getSdk(): AtlasSdkValue<CustomerHostSdk> {
    if (!this.sdk) throw new Error('SDK was not configured.');
    return this.sdk;
  }

  private getAtlas(): AngularAtlasSdk<CustomerHostSdk> {
    if (!this.atlas) throw new Error('Angular SDK was not injected.');
    return this.atlas;
  }
}

function createNavigation(): AtlasNavigation {
  return {
    navigate(): void {},
    replace(): void {},
    back(): void {},
    createHref: (to) => to,
    subscribe: () => () => undefined,
    getCurrentLocation: () => ({ pathname: '/', search: '', hash: '' }),
  };
}
