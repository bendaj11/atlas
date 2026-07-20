import type { AtlasDeploymentCatalog, AtlasExportedWidgetManifest, AtlasHostRuntimeConfig, AtlasManifest } from "@atlas/schema";
import type { AtlasSdk } from "./host.js";
import type { AtlasGetWidgetOptions, AtlasWidgetHandle } from "./sdk-types.js";
import type { AtlasRouteContext, AtlasScopedNavigation } from "./navigation.js";

/** Runtime context scoped to one mounted app and its assigned host route. */
export interface AtlasAppContext {
  manifest: AtlasManifest;
  hostId: string;
  basePath: string;
  navigation: AtlasScopedNavigation;
  route: AtlasRouteContext;
  readonly loading: {
    show(): void;
    hide(): void;
    waitUntilReady(): () => void;
  };
}

export interface AtlasAppMountRequest<THostSdk extends object = {}> {
  container: HTMLElement;
  sdk: AtlasSdk<THostSdk>;
  context: AtlasAppContext;
}

export interface AtlasAppMountResult {
  unmount?: () => void | Promise<void>;
}

/** Framework-neutral lifecycle exposed by every versioned host client. */
export interface AtlasHostClientEntry {
  mount(request: {
    container: HTMLElement;
    runtimeConfig: AtlasHostRuntimeConfig;
    catalog: AtlasDeploymentCatalog;
  }): void | AtlasAppMountResult | Promise<void | AtlasAppMountResult>;
}

/** Framework-neutral lifecycle contract exposed by every app remote entry. */
export interface AtlasAppEntry<THostSdk extends object = {}> {
  mount(request: AtlasAppMountRequest<THostSdk>): void | AtlasAppMountResult | Promise<void | AtlasAppMountResult>;
}

export interface AtlasExportedWidgetMountRequest<
  TProps extends object = Record<string, unknown>,
  THostSdk extends object = {}
> {
  container: HTMLElement;
  props: TProps;
  sdk: AtlasSdk<THostSdk>;
  widget: AtlasExportedWidgetManifest;
  ownerManifest: AtlasManifest;
}

export interface AtlasExportedWidgetEntry<TProps extends object = Record<string, unknown>> {
  mount(request: AtlasExportedWidgetMountRequest<TProps>): void | AtlasExportedWidgetMountResult<TProps> | Promise<void | AtlasExportedWidgetMountResult<TProps>>;
}

export interface AtlasExportedWidgetMountResult<TInputs extends object = Record<string, unknown>> extends AtlasAppMountResult {
  setInputs?(inputs: TInputs): void;
}

export interface AtlasMountedWidget<TInputs extends object = Record<string, unknown>> {
  widget: AtlasExportedWidgetManifest | undefined;
  setInputs?(inputs: TInputs): void;
  unmount(): Promise<void>;
}

/** Loads widgets only from owner versions selected in the current host catalog. */
export interface AtlasWidgetLoader {
  list(ownerAppId?: string): AtlasExportedWidgetManifest[];
  getWidget<TInputs extends object = Record<string, unknown>>(
    widgetId: string,
    options?: AtlasGetWidgetOptions
  ): AtlasWidgetHandle<TInputs>;
  mount<TProps extends object = Record<string, unknown>>(
    widgetId: string,
    container: HTMLElement,
    props: TProps
  ): Promise<AtlasMountedWidget<TProps>>;
}
