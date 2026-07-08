import type { AtlasExportedWidgetEntry, AtlasExportedWidgetMountRequest, AtlasMfEntry, AtlasMfMountRequest, AtlasMfMountResult } from "./lifecycle.js";

export interface AppBootstrap {
  (request: AtlasMfMountRequest): void | AtlasMfMountResult | Promise<void | AtlasMfMountResult>;
}

export function defineApp(bootstrap: AppBootstrap): AtlasMfEntry {
  return {
    mount(request) {
      return bootstrap(request);
    }
  };
}

export function defineExportedWidget<TProps extends object>(
  bootstrap: (request: AtlasExportedWidgetMountRequest<TProps>) => void | AtlasMfMountResult | Promise<void | AtlasMfMountResult>
): AtlasExportedWidgetEntry<TProps> {
  return { mount: bootstrap };
}
