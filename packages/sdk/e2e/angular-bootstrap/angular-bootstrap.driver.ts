import '@angular/compiler';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import {
  ApplicationRef,
  createEnvironmentInjector,
  InjectionToken,
  runInInjectionContext,
  type ApplicationConfig,
  type EnvironmentInjector,
} from '@angular/core';
import {
  createAtlasAppAssets,
  createAtlasSdk,
  updateAtlasHostData,
  type AtlasAppContext,
  type AtlasSdk,
} from '../../src/index.js';
import {
  defineApp,
  injectAtlasSdk,
  provideAtlasAppContext,
  provideAtlasSdk,
  type AtlasSdk as AngularAtlasSdk,
} from '../../src/angular.js';
import {
  anAppContext,
  anAppManifest,
} from '../../src/testkit/app-context.testkit.js';
import { aMemoryNavigation } from '../../src/testkit/navigation.testkit.js';

interface CustomerSdk {
  readonly hostData: { readonly userName: string };
  showMessage(message: string): void;
}

const ASSET_BASE_URL = new InjectionToken<string>('asset base URL');
const LOGO_URL = new InjectionToken<string>('logo URL');

function createAppConfig({
  sdk,
  context,
}: {
  sdk: AtlasSdk;
  context: AtlasAppContext;
}): ApplicationConfig {
  const assets = createAtlasAppAssets(context);

  return {
    providers: [
      ...provideAtlasAppContext(context),
      provideAtlasSdk(sdk),
      { provide: ASSET_BASE_URL, useValue: assets.assetBaseUrl() },
      { provide: LOGO_URL, useValue: assets.assetUrl('images/logo.svg') },
    ],
  };
}

export class AngularBootstrapDriver {
  private readonly message = faker.lorem.sentence();
  private readonly showMessage = jest.fn<(message: string) => void>();
  private readonly hostSdk: AtlasSdk<CustomerSdk> = createAtlasSdk<CustomerSdk>(
    {
      hostId: faker.string.uuid(),
      hostData: { userName: faker.person.firstName() },
      navigation: aMemoryNavigation(),
      showMessage: this.showMessage,
    },
  );
  private readonly injectors: EnvironmentInjector[] = [];
  private readonly injectedSdks: AngularAtlasSdk<CustomerSdk>[] = [];
  private bootstrapSdk?: AtlasSdk;
  private bootstrapFailure?: Error;

  readonly given = {
    bootstrapFailure: (message: string) => {
      this.bootstrapFailure = new Error(message);
      return this;
    },
  };

  readonly when = {
    injectInHost: () => {
      const injector = createEnvironmentInjector(
        [
          provideAtlasSdk(() => this.hostSdk),
          { provide: ApplicationRef, useValue: {} },
        ],
        null!,
      );
      this.injectors.push(injector);
      this.injectedSdks.push(
        runInInjectionContext(injector, () => injectAtlasSdk<CustomerSdk>()),
      );
    },
    sendMessage: () => {
      this.injectedSdks[0].showMessage(this.message);
    },
    mount: async (remoteEntryUrl: string) => {
      const app = defineApp(async (request) => {
        if (this.bootstrapFailure) throw this.bootstrapFailure;

        this.bootstrapSdk = request.sdk;
        const config = createAppConfig(request);
        const injector = createEnvironmentInjector(
          [...config.providers, { provide: ApplicationRef, useValue: {} }],
          null!,
        );
        this.injectors.push(injector);
        this.injectedSdks.push(
          runInInjectionContext(injector, () => injectAtlasSdk<CustomerSdk>()),
        );
      });

      await app.mount({
        container: {} as HTMLElement,
        styleTarget: {} as HTMLElement,
        sdk: this.hostSdk,
        context: anAppContext({ manifest: anAppManifest({ remoteEntryUrl }) }),
      });
    },
    updateHostData: (userName: string) => {
      updateAtlasHostData(this.hostSdk, { userName });
    },
    cleanup: () => {
      for (const injector of this.injectors) injector.destroy();
    },
  };

  readonly get = {
    injectedHostId: () => this.injectedSdks[0].hostId,
    hostId: () => this.hostSdk.hostId,
    messageHandler: () => this.showMessage,
    message: () => this.message,
    assetBaseUrl: () => this.injectedSdks[0].assetBaseUrl(),
    assetUrl: (path: string) => this.injectedSdks[0].assetUrl(path),
    hostSdk: () => this.hostSdk,
    bootstrapSdk: () => this.bootstrapSdk,
    copiedSdk: () => ({ ...this.bootstrapSdk }),
    configuredBaseUrls: () =>
      this.injectors.map((injector) => injector.get(ASSET_BASE_URL)),
    configuredLogoUrls: () =>
      this.injectors.map((injector) => injector.get(LOGO_URL)),
    userNames: () => this.injectedSdks.map((sdk) => sdk.hostData().userName),
  };
}
