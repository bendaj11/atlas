import '@angular/compiler';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import {
  APP_ID,
  ApplicationRef,
  createEnvironmentInjector,
  runInInjectionContext,
  type EnvironmentInjector,
  type Provider,
} from '@angular/core';
import type { AtlasAppContext } from '../../lifecycle.js';
import { updateAtlasHostData } from '../../core/host-data/host-data.js';
import { createAtlasSdk } from '../../core/sdk-factory/sdk-factory.js';
import type { AtlasSdk as AtlasSdkValue } from '../../core/sdk-types/sdk-types.js';
import { anAppContext } from '../../testkit/app-context.testkit.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import {
  injectAppLoaded,
  injectAtlasAppContext,
  injectAtlasSdk,
  provideAtlasAppContext,
  provideAtlasSdk,
  type AtlasSdk as AngularAtlasSdk,
} from './angular-injection.js';

interface CustomerHostSdk {
  readonly hostData: { readonly userName: string };
  readonly greet: () => string;
}

export class AngularInjectionDriver {
  private readonly greet = jest.fn<CustomerHostSdk['greet']>();
  private readonly waitUntilReady = jest.fn<() => () => void>(
    () => () => undefined,
  );
  private readonly sdk: AtlasSdkValue<CustomerHostSdk> =
    createAtlasSdk<CustomerHostSdk>({
      hostId: faker.string.uuid(),
      hostData: { userName: faker.person.firstName() },
      navigation: aMemoryNavigation(),
      greet: this.greet,
    });
  private context: AtlasAppContext | undefined = anAppContext({
    loading: {
      show: () => undefined,
      hide: () => undefined,
      waitUntilReady: this.waitUntilReady,
    },
  });
  private injector!: EnvironmentInjector;
  private atlas!: AngularAtlasSdk<CustomerHostSdk>;

  readonly given = {
    userName: (userName: string): this => {
      updateAtlasHostData(this.sdk, { userName });

      return this;
    },
    appContext: (context: AtlasAppContext | undefined): this => {
      this.context = context;

      return this;
    },
  };

  readonly when = {
    injected: (): void => {
      this.injector = createEnvironmentInjector(this.providers(), null!);
      this.atlas = runInInjectionContext(this.injector, () =>
        injectAtlasSdk<CustomerHostSdk>(),
      );
    },
    userRenamed: (userName: string): void => {
      updateAtlasHostData(this.sdk, { userName });
    },
    injectorDestroyed: (): void => {
      this.injector.destroy();
    },
  };

  readonly get = {
    atlas: (): AngularAtlasSdk<CustomerHostSdk> => this.atlas,
    greetMock: (): jest.Mock<CustomerHostSdk['greet']> => this.greet,
    waitUntilReadyMock: (): jest.Mock<() => () => void> => this.waitUntilReady,
    appId: (): string => this.injector.get(APP_ID),
    injectedAppContext: (): AtlasAppContext =>
      runInInjectionContext(this.injector, injectAtlasAppContext),
    appLoaded: (): (() => void) =>
      runInInjectionContext(this.injector, injectAppLoaded),
    context: (): AtlasAppContext | undefined => this.context,
  };

  private providers(): Provider[] {
    return [
      provideAtlasSdk(() => this.sdk),
      ...(this.context ? provideAtlasAppContext(this.context) : []),
      { provide: ApplicationRef, useValue: Object.create(null) },
    ];
  }
}
