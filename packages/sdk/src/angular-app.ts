import type { AtlasExportedWidgetEntry, AtlasExportedWidgetMountRequest, AtlasAppEntry, AtlasAppMountRequest, AtlasAppMountResult } from "./lifecycle.js";

export interface AppBootstrap {
  (request: AtlasAppMountRequest): void | AtlasAppMountResult | Promise<void | AtlasAppMountResult>;
}

export function defineApp(bootstrap: AppBootstrap): AtlasAppEntry {
  return {
    mount(request) {
      return bootstrap(request);
    }
  };
}

export function defineExportedWidget<TProps extends object>(
  bootstrap: (request: AtlasExportedWidgetMountRequest<TProps>) => void | AtlasAppMountResult | Promise<void | AtlasAppMountResult>
): AtlasExportedWidgetEntry<TProps> {
  return { mount: bootstrap };
}
