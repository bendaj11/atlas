import '@angular/compiler';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import {
  APP_ID,
  createEnvironmentInjector,
  EnvironmentInjector,
  inject,
  runInInjectionContext,
} from '@angular/core';
import { LocationStrategy } from '@angular/common';
import { ɵSharedStylesHost } from '@angular/platform-browser';
import { createAtlasSdk } from '../../core/sdk-factory/index.js';
import { injectAtlasAppContext } from '../angular-injection/index.js';
import type { LocationStrategyAdapter } from '../angular-types/angular-types.js';
import type { StyleHostMutation } from '../angular-style-host/angular-style-host.js';
import { anAppContext } from '../../testkit/app-context.testkit.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import type { AtlasAppContext } from '../../lifecycle.js';
import { provideAtlasApp } from './provide-atlas-app.js';

class RecordingStylesHost {
  readonly addHost = jest.fn<StyleHostMutation>();
  readonly removeHost = jest.fn<StyleHostMutation>();
}

export class ProvideAtlasAppDriver {
  private readonly stylesHost = new RecordingStylesHost();
  private readonly styleTarget = document
    .createElement('div')
    .attachShadow({ mode: 'open' });
  private readonly context = anAppContext();
  private readonly sdk = createAtlasSdk({
    hostId: faker.string.uuid(),
    navigation: aMemoryNavigation(),
  });
  private locationStrategy: LocationStrategyAdapter | undefined;
  private injector!: EnvironmentInjector;

  readonly given = {
    locationStrategy: (strategy: LocationStrategyAdapter | undefined): this => {
      this.locationStrategy = strategy;

      return this;
    },
  };

  readonly when = {
    providersCreated: (): void => {
      this.injector = createEnvironmentInjector(
        [
          { provide: ɵSharedStylesHost, useValue: this.stylesHost },
          provideAtlasApp({
            context: this.context,
            sdk: this.sdk,
            styleTarget: this.styleTarget,
            ...(this.locationStrategy
              ? { locationStrategy: this.locationStrategy }
              : {}),
          }),
        ],
        null!,
      );
      runInInjectionContext(this.injector, () => inject(ɵSharedStylesHost));
    },
  };

  readonly get = {
    appId: (): string => this.injector.get(APP_ID),
    injectedContext: (): AtlasAppContext =>
      runInInjectionContext(this.injector, injectAtlasAppContext),
    injectedLocationStrategy: (): LocationStrategy | null =>
      this.injector.get(LocationStrategy, null),
    addHostMock: () => this.stylesHost.addHost,
    removeHostMock: () => this.stylesHost.removeHost,
    context: () => this.context,
    styleTarget: () => this.styleTarget,
  };
}
