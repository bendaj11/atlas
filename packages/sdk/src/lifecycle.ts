import type { AtlasExportedComponentManifest, AtlasManifest } from "@atlas/contracts";
import type { AtlasSdk } from "./host.js";
import type { AtlasRouteContext, AtlasScopedNavigation } from "./navigation.js";

/** Runtime context scoped to one mounted MF and its assigned host route. */
export interface AtlasMfContext {
  manifest: AtlasManifest;
  hostId: string;
  basePath: string;
  navigation: AtlasScopedNavigation;
  route: AtlasRouteContext;
  /** @deprecated Use widgets. */
  components: AtlasComponentLoader;
  widgets: AtlasWidgetLoader;
  readonly loading: {
    show(): void;
    hide(): void;
  };
  ready(): void;
}

export interface AtlasMfMountRequest<TExtensions extends object = {}> {
  container: HTMLElement;
  sdk: AtlasSdk<TExtensions>;
  /** @deprecated Use sdk. */
  hostSdk: AtlasSdk<TExtensions>;
  context: AtlasMfContext;
}

export interface AtlasMfMountResult {
  unmount?: () => void | Promise<void>;
}

/** Framework-neutral lifecycle contract exposed by every MF remote entry. */
export interface AtlasMfEntry<TExtensions extends object = {}> {
  mount(request: AtlasMfMountRequest<TExtensions>): void | AtlasMfMountResult | Promise<void | AtlasMfMountResult>;
}

export interface AtlasExportedComponentMountRequest<
  TProps extends object = Record<string, unknown>,
  TExtensions extends object = {}
> {
  container: HTMLElement;
  props: TProps;
  sdk: AtlasSdk<TExtensions>;
  /** @deprecated Use sdk. */
  hostSdk: AtlasSdk<TExtensions>;
  component: AtlasExportedComponentManifest;
  ownerManifest: AtlasManifest;
}

export interface AtlasExportedComponentEntry<TProps extends object = Record<string, unknown>> {
  mount(request: AtlasExportedComponentMountRequest<TProps>): void | AtlasMfMountResult | Promise<void | AtlasMfMountResult>;
}

export interface AtlasMountedWidget {
  component: AtlasExportedComponentManifest;
  unmount(): Promise<void>;
}

/** Loads widgets only from owner versions selected in the current host catalog. */
export interface AtlasWidgetLoader {
  list(ownerMfId?: string): AtlasExportedComponentManifest[];
  mount<TProps extends object = Record<string, unknown>>(
    widgetRef: string,
    container: HTMLElement,
    props: TProps
  ): Promise<AtlasMountedWidget>;
}

/** @deprecated Use AtlasWidgetLoader. */
export type AtlasComponentLoader = AtlasWidgetLoader;

/** @deprecated Use AtlasMountedWidget. */
export type AtlasMountedComponent = AtlasMountedWidget;
