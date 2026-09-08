import {
  createComponent,
  ENVIRONMENT_INITIALIZER,
  inject,
  makeEnvironmentProviders,
  type ApplicationConfig,
  type EnvironmentProviders,
  type Provider,
  type Type,
} from '@angular/core';
import { LocationStrategy } from '@angular/common';
import {
  createApplication,
  ɵSharedStylesHost,
} from '@angular/platform-browser';
import { attachAngularComponentStyles } from './angular-style-host.js';
import {
  provideAtlasAppContext,
  provideAtlasSdk,
} from './angular-injection.js';
import type { LocationStrategyAdapter } from './angular-types.js';
import type { AtlasSdk as AtlasSdkValue } from './host.js';
import type {
  AtlasExportedWidgetEntry,
  AtlasExportedWidgetMountRequest,
  AtlasAppEntry,
  AtlasAppContext,
  AtlasAppMountRequest,
  AtlasAppMountResult,
} from './lifecycle.js';

export interface AppBootstrap {
  (
    request: AtlasAppMountRequest,
  ): void | AtlasAppMountResult | Promise<void | AtlasAppMountResult>;
}

export function defineApp(bootstrap: AppBootstrap): AtlasAppEntry {
  return {
    mount(request) {
      return bootstrap(request);
    },
  };
}

export function defineExportedWidget<TProps extends object>(
  bootstrap: (
    request: AtlasExportedWidgetMountRequest<TProps>,
  ) => void | AtlasAppMountResult | Promise<void | AtlasAppMountResult>,
): AtlasExportedWidgetEntry<TProps> {
  return { mount: bootstrap };
}

/** Adds Atlas Shadow DOM style hosting without taking over application bootstrap. */
function provideAtlasAngularStyles(styleTarget: Node & ParentNode): Provider {
  return {
    provide: ENVIRONMENT_INITIALIZER,
    multi: true,
    useValue: () =>
      attachAngularComponentStyles({
        styleHost: inject(ɵSharedStylesHost),
        styleTarget,
        documentHead: styleTarget.ownerDocument?.head,
      }),
  };
}

export interface AtlasAngularAppOptions {
  readonly context: AtlasAppContext;
  readonly sdk: AtlasSdkValue;
  readonly styleTarget: Node & ParentNode;
  readonly locationStrategy?: LocationStrategyAdapter;
}

/** Provides Atlas app context, SDK, runtime styles, and optional router strategy. */
export function provideAtlasApp(
  options: AtlasAngularAppOptions,
): EnvironmentProviders {
  const { context, sdk, styleTarget, locationStrategy } = options;
  return makeEnvironmentProviders([
    provideAtlasAngularStyles(styleTarget),
    ...provideAtlasAppContext(context),
    provideAtlasSdk(sdk),
    ...(locationStrategy
      ? [{ provide: LocationStrategy, useValue: locationStrategy }]
      : []),
  ]);
}

export function createExportedWidget<TProps extends object>(
  componentType: Type<unknown>,
  config: ApplicationConfig = { providers: [] },
): AtlasExportedWidgetEntry<TProps> {
  return defineExportedWidget(
    async ({ props, sdk, context, styleTarget, container }) => {
      const application = await createApplication({
        ...config,
        providers: [
          provideAtlasApp({ context, sdk, styleTarget }),
          ...config.providers,
        ],
      });
      const component = createComponent(componentType, {
        environmentInjector: application.injector,
        hostElement: container,
      });
      application.attachView(component.hostView);
      for (const [name, value] of Object.entries(props))
        component.setInput(name, value);
      component.changeDetectorRef.detectChanges();

      return {
        setInputs(inputs: TProps) {
          for (const [name, value] of Object.entries(inputs))
            component.setInput(name, value);
          component.changeDetectorRef.detectChanges();
        },
        unmount() {
          application.detachView(component.hostView);
          component.destroy();
          application.destroy();
        },
      };
    },
  );
}
