import type {
  AtlasHostCatalog,
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
} from '@atlas/schema';

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

export interface RemoteMetadata {
  buildNotificationsEndpoint?: string;
  exposes?: Array<{ key?: string; outFileName?: string }>;
  shared?: Array<{ packageName?: string; outFileName?: string }>;
}

export interface RuntimeAppOverride {
  appId?: string;
  manifest?: AtlasManifest;
}

export interface RuntimeOverrides {
  hostId?: string;
  host?: { manifest?: AtlasHostManifest };
  hostOverride?: AtlasHostManifest;
  apps?: RuntimeAppOverride[];
  overrides?: RuntimeAppOverride[];
}

export interface DevSession {
  schemaVersion?: string;
  hostId?: string;
  generatedAt?: string;
  catalog?: AtlasHostCatalog;
  hostOverride?: AtlasHostManifest;
  overrides?: RuntimeAppOverride[];
}

export interface ModuleShimGlobal {
  esmsInitOptions?: { shimMode: boolean };
  importShim?: (url: string) => Promise<HostModule>;
}

export interface BootstrapFailure {
  message: string;
  suggestedActions: string[];
  code: 'ATLAS_BOOTSTRAP_FAILED';
  cause: Error;
}
