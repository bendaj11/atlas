import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';

export interface HostEntry {
  mount?(request: HostMountRequest): Promise<void>;
}

export interface HostMountRequest {
  container: HTMLElement;
  runtimeConfig: AtlasHostRuntimeConfig;
  catalog: AtlasHostCatalog;
}

export interface HostModule extends HostEntry {
  default?: HostEntry;
}
