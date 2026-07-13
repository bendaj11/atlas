import type { AtlasDeploymentCatalog, AtlasExportedWidgetManifest, AtlasHostRuntimeConfig, AtlasManifest } from "@atlas/schema";
import type { AtlasSdk } from "./host.js";
import type { AtlasWidgetHandle } from "./sdk-types.js";
import type { AtlasRouteContext, AtlasScopedNavigation } from "./navigation.js";

/** Runtime context scoped to one mounted app and its assigned host route. */
export interface AtlasAppContext {
  manifest: AtlasManifest;
  hostId: string;
  basePath: string;
  navigation: AtlasScopedNavigation;
  route: AtlasRouteContext;
  widgets: AtlasWidgetLoader;
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
  mount(request: AtlasExportedWidgetMountRequest<TProps>): void | AtlasAppMountResult | Promise<void | AtlasAppMountResult>;
}

export interface AtlasMountedWidget {
  widget: AtlasExportedWidgetManifest | undefined;
  unmount(): Promise<void>;
}

/** Loads widgets only from owner versions selected in the current host catalog. */
export interface AtlasWidgetLoader {
  list(ownerAppId?: string): AtlasExportedWidgetManifest[];
  getWidget(widgetId: string): Promise<AtlasWidgetHandle>;
  mount<TProps extends object = Record<string, unknown>>(
    widgetId: string,
    container: HTMLElement,
    props: TProps
  ): Promise<AtlasMountedWidget>;
}
