import '@angular/compiler';
import { faker } from '@faker-js/faker';
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
import { createAppContext } from '../../src/app-context.testkit.js';

interface CustomerSdk {
  readonly hostData: { readonly userName: string };
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
  private readonly hostSdk: AtlasSdk<CustomerSdk> = createAtlasSdk<CustomerSdk>(
    {
      hostId: faker.string.uuid(),
      hostData: { userName: faker.person.firstName() },
      navigation: createAppContext('https://cdn.example/remoteEntry.json')
        .navigation,
    },
  );
  private readonly injectors: EnvironmentInjector[] = [];
  private readonly injectedSdks: AngularAtlasSdk<CustomerSdk>[] = [];
  private bootstrapSdk?: AtlasSdk;
  private bootstrapFailure?: Error;

  readonly given = {
    bootstrapFailure: (message: string): this => {
      this.bootstrapFailure = new Error(message);
      return this;
    },
  };

  readonly when = {
    mount: async (remoteEntryUrl: string): Promise<void> => {
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
        sdk: this.hostSdk,
        context: createAppContext(remoteEntryUrl),
      });
    },
    updateHostData: (userName: string): void => {
      updateAtlasHostData(this.hostSdk, { userName });
    },
    cleanup: (): void => {
      for (const injector of this.injectors) injector.destroy();
    },
  };

  readonly get = {
    hostSdk: (): AtlasSdk<CustomerSdk> => this.hostSdk,
    bootstrapSdk: (): AtlasSdk | undefined => this.bootstrapSdk,
    copiedSdk: (): object => ({ ...this.bootstrapSdk }),
    configuredBaseUrls: (): string[] =>
      this.injectors.map((injector) => injector.get(ASSET_BASE_URL)),
    configuredLogoUrls: (): string[] =>
      this.injectors.map((injector) => injector.get(LOGO_URL)),
    userNames: (): string[] =>
      this.injectedSdks.map((sdk) => sdk.hostData().userName),
  };
}
