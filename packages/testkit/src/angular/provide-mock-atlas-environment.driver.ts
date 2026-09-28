import '@angular/compiler';
import {
  ApplicationRef,
  createEnvironmentInjector,
  inject,
  runInInjectionContext,
  type EnvironmentInjector,
} from '@angular/core';
import { LocationStrategy } from '@angular/common';
import {
  injectAppLoaded,
  injectAtlasSdk,
  type AtlasSdk as AngularAtlasSdk,
} from '@atlas/sdk/angular';
import type {
  MockAtlasEnvironment,
  MockAtlasEnvironmentOverrides,
} from '../atlas-environment/atlas-environment.types.js';
import { mockAtlasEnvironment } from '../atlas-environment/atlas-environment.js';
import { provideMockAtlasEnvironment } from './provide-mock-atlas-environment.js';

export interface CustomerHostSdk {
  hostData: { userName: string };
  greet(): string;
}

export class ProvideMockAtlasEnvironmentDriver {
  private overrides: MockAtlasEnvironmentOverrides<CustomerHostSdk> = {};
  private environment!: MockAtlasEnvironment<CustomerHostSdk>;
  private injector!: EnvironmentInjector;

  readonly given = {
    overrides: (overrides: MockAtlasEnvironmentOverrides<CustomerHostSdk>) => {
      this.overrides = overrides;

      return this;
    },
  };

  readonly when = {
    provided: () => {
      this.environment = mockAtlasEnvironment(this.overrides);
      this.injector = createEnvironmentInjector(
        [
          provideMockAtlasEnvironment(this.environment),
          { provide: ApplicationRef, useValue: Object.create(null) },
        ],
        null!,
      );
    },
  };

  readonly get = {
    environment: () => this.environment,
    atlas: () =>
      this.runInInjector<AngularAtlasSdk<CustomerHostSdk>>(() =>
        injectAtlasSdk<CustomerHostSdk>(),
      ),
    locationStrategy: () => this.runInInjector(() => inject(LocationStrategy)),
    appLoaded: () => this.runInInjector(() => injectAppLoaded()),
  };

  private runInInjector<TValue>(read: () => TValue) {
    return runInInjectionContext(this.injector, read);
  }
}
