import '@angular/compiler';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import {
  ApplicationRef,
  createEnvironmentInjector,
  runInInjectionContext,
  type EnvironmentInjector,
  type Provider,
} from '@angular/core';
import type { AtlasAppContext } from '../../lifecycle.js';
import { updateAtlasHostData } from '../../core/host-data/host-data.js';
import { createAtlasSdk } from '../../core/sdk-factory/index.js';
import type { AtlasSdk as AtlasSdkValue } from '../../core/sdk-types/index.js';
import { anAppContext } from '../../testkit/app-context.testkit.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import {
  injectAtlasSdk,
  type AtlasSdk as AngularAtlasSdk,
} from './inject-atlas-sdk.js';
import { provideAtlasAppContext, provideAtlasSdk } from './providers.js';

interface CustomerHostSdk {
  readonly hostData: { readonly userName: string };
  readonly greet: () => string;
}

export class InjectAtlasSdkDriver {
  private readonly greet = jest.fn<CustomerHostSdk['greet']>();
  private readonly sdk: AtlasSdkValue<CustomerHostSdk> =
    createAtlasSdk<CustomerHostSdk>({
      hostId: faker.string.uuid(),
      hostData: { userName: faker.person.firstName() },
      navigation: aMemoryNavigation(),
      greet: this.greet,
    });
  private context: AtlasAppContext | undefined = anAppContext();
  private injector!: EnvironmentInjector;
  private atlas!: AngularAtlasSdk<CustomerHostSdk>;

  readonly given = {
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
