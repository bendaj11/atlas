import '@angular/compiler';
import {
  createEnvironmentInjector,
  runInInjectionContext,
  ApplicationRef,
  type EnvironmentInjector,
} from '@angular/core';
import {
  injectAtlasSdk,
  provideAtlasAppContext,
  provideAtlasSdk,
  type AtlasSdk as AngularAtlasSdk,
} from './angular-injection.js';
import { updateAtlasHostData } from './host-data.js';
import { createAtlasSdk } from './sdk-factory.js';
import type { AtlasSdk as AtlasSdkValue } from './sdk-types.js';
import type { AtlasNavigation } from './navigation-types.js';
import { createAppContext } from './app-context.testkit.js';

interface CustomerHostSdk {
  readonly hostData: {
    readonly userName: string;
  };
  readonly getGreeting: () => string;
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
        getGreeting: () => `Hello, ${userName}`,
      });
      this.injector = createEnvironmentInjector(
        [
          provideAtlasSdk(() => this.getSdk()),
          ...provideAtlasAppContext(
            createAppContext(
              'https://cdn.example/apps/orders/1.2.3/remoteEntry.json',
            ),
          ),
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
    greeting: (): string => this.getAtlas().getGreeting(),
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
