import '@angular/compiler';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import {
  APP_ID,
  createEnvironmentInjector,
  EnvironmentInjector,
  ErrorHandler,
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
  private readonly markReady = jest.fn<() => void>();
  private readonly waitUntilReady = jest.fn<() => () => void>();
  private readonly fail = jest.fn<(error: unknown) => void>();
  private readonly consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  private readonly context = anAppContext({
    loading: {
      show: () => undefined,
      hide: () => undefined,
      waitUntilReady: this.waitUntilReady,
    },
    fail: this.fail,
  });
  private releaseReadiness: () => void = () => undefined;
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
    readinessRequested: () => {
      this.waitUntilReady.mockReturnValue(this.markReady);
      this.releaseReadiness = runInInjectionContext(
        this.injector,
        injectAtlasAppContext,
      ).loading.waitUntilReady();
    },
    readinessReleased: () => this.releaseReadiness(),
    errorHandled: (error: unknown) =>
      this.injector.get(ErrorHandler).handleError(error),
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
    waitUntilReadyMock: () => this.waitUntilReady,
    markReadyMock: () => this.markReady,
    failMock: () => this.fail,
    consoleErrorMock: () => this.consoleError,
    styleTarget: () => this.styleTarget,
  };
}
