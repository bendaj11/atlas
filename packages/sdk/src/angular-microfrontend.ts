import type { AtlasExportedComponentEntry, AtlasExportedComponentMountRequest, AtlasMfEntry, AtlasMfMountRequest, AtlasMfMountResult } from "./lifecycle.js";

export interface MicrofrontendBootstrap {
  (request: AtlasMfMountRequest): void | AtlasMfMountResult | Promise<void | AtlasMfMountResult>;
}

export function defineMicrofrontend(bootstrap: MicrofrontendBootstrap): AtlasMfEntry {
  return {
    mount(request) {
      return bootstrap(request);
    }
  };
}

export function defineExportedComponent<TProps extends object>(
  bootstrap: (request: AtlasExportedComponentMountRequest<TProps>) => void | AtlasMfMountResult | Promise<void | AtlasMfMountResult>
): AtlasExportedComponentEntry<TProps> {
  return { mount: bootstrap };
}
