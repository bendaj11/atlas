import type {
  AtlasAppEntry,
  AtlasAppMountRequest,
  AtlasAppMountResult,
  AtlasExportedWidgetEntry,
  AtlasExportedWidgetMountRequest,
} from '../../lifecycle.js';

export interface AppBootstrap {
  (
    request: AtlasAppMountRequest,
  ): void | AtlasAppMountResult | Promise<void | AtlasAppMountResult>;
}

export interface ExportedWidgetBootstrap<TProps extends object> {
  (
    request: AtlasExportedWidgetMountRequest<TProps>,
  ): void | AtlasAppMountResult | Promise<void | AtlasAppMountResult>;
}

/** Wraps an Angular bootstrap function as an Atlas app entry. */
export function defineApp(bootstrap: AppBootstrap): AtlasAppEntry {
  return {
    mount(request) {
      return bootstrap(request);
    },
  };
}

/** Wraps an Angular bootstrap function as an Atlas exported widget entry. */
export function defineExportedWidget<TProps extends object>(
  bootstrap: ExportedWidgetBootstrap<TProps>,
): AtlasExportedWidgetEntry<TProps> {
  return { mount: bootstrap };
}
