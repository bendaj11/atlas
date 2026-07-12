import type { AtlasExportedWidgetManifest, AtlasManifest } from "@atlas/schema";
import type { AtlasEventMap, AtlasSdk } from "./host.js";
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

export interface AtlasAppMountRequest<
  TExtensions extends object = {},
  TEvents extends object = AtlasEventMap,
  THostData extends object = {}
> {
  container: HTMLElement;
  sdk: AtlasSdk<TExtensions, TEvents, THostData>;
  context: AtlasAppContext;
}

export interface AtlasAppMountResult {
  unmount?: () => void | Promise<void>;
}

/** Framework-neutral lifecycle contract exposed by every app remote entry. */
export interface AtlasAppEntry<
  TExtensions extends object = {},
  TEvents extends object = AtlasEventMap,
  THostData extends object = {}
> {
  mount(request: AtlasAppMountRequest<TExtensions, TEvents, THostData>): void | AtlasAppMountResult | Promise<void | AtlasAppMountResult>;
}

export interface AtlasExportedWidgetMountRequest<
  TProps extends object = Record<string, unknown>,
  TExtensions extends object = {},
  TEvents extends object = AtlasEventMap,
  THostData extends object = {}
> {
  container: HTMLElement;
  props: TProps;
  sdk: AtlasSdk<TExtensions, TEvents, THostData>;
  widget: AtlasExportedWidgetManifest;
  ownerManifest: AtlasManifest;
}

export interface AtlasExportedWidgetEntry<TProps extends object = Record<string, unknown>> {
  mount(request: AtlasExportedWidgetMountRequest<TProps>): void | AtlasAppMountResult | Promise<void | AtlasAppMountResult>;
}

export interface AtlasMountedWidget {
  widget: AtlasExportedWidgetManifest;
  unmount(): Promise<void>;
}

/** Loads widgets only from owner versions selected in the current host catalog. */
export interface AtlasWidgetLoader {
  list(ownerAppId?: string): AtlasExportedWidgetManifest[];
  mount<TProps extends object = Record<string, unknown>>(
    widgetRef: string,
    container: HTMLElement,
    props: TProps
  ): Promise<AtlasMountedWidget>;
}
