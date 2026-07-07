import type { AtlasDomIsolation } from "./atlas-dom-isolation.js";
import type { AtlasFramework } from "./atlas-framework.js";
import type { AtlasRouteNavigation } from "./atlas-route-navigation.js";

/** Shared Atlas source config fields for hosts and microfrontends. */
export interface AtlasBaseConfig {
  /** Stable Atlas app or host id. Used in manifests, catalogs, and generated runtime files. */
  id: string;
  /** Display name for generated manifests and host UI. Defaults to id. */
  name?: string;
  /** UI framework used by this host or app. */
  framework: AtlasFramework;
}

/** Source config developers write for host projects. */
export interface AtlasHostConfig extends AtlasBaseConfig {
  /** Allow Atlas tools to override selected app manifests at runtime. Defaults to true. */
  allowAppOverrides?: boolean;
  /** Maximum time Atlas waits for runtime resources, app loading, and app readiness. */
  resourcesTimeoutMs?: number;
  /** Number of retries after the first failed Atlas resource request. Defaults to three. */
  resourcesRetryCount?: number;
}

/** Source config developers write for microfrontend projects. */
export interface AtlasMicrofrontendConfig extends AtlasBaseConfig {
  /** DOM/CSS boundary requested when a host mounts this app. Defaults to scoped. */
  domIsolation?: AtlasDomIsolation;
  /** Page routes this app contributes to hosts. */
  routes?: AtlasRouteMount[];
  /** Named host areas this app can render into. */
  slots?: AtlasSlotMount[];
  /** Host SDK version range generated manifests should require. */
  requiredHostSdkVersion?: string;
}

/** Route this app contributes to one host. */
export interface AtlasRouteMount {
  /** Short stable id for this route mount, unique inside this app. */
  id: string;
  /** Host app this route belongs to. */
  hostId: string;
  /** URL path users visit to see this app, such as "/checkout". No query string or hash. */
  basePath: string;
  /** Text hosts can show as the page title, breadcrumb, or menu title. */
  title: string;
  /** Optional menu settings if the host shows this route in navigation. */
  nav?: AtlasRouteNavigation;
}

/** Slot this app can fill inside one host. */
export interface AtlasSlotMount {
  /** Short stable id for this slot mount, unique inside this app. */
  id: string;
  /** Host app this slot belongs to. */
  hostId: string;
  /** Host slot name this app renders into. */
  name: string;
}

/** Source config developers write so Atlas can build manifests and runtime files. */
export type AtlasConfig = AtlasHostConfig | AtlasMicrofrontendConfig;
