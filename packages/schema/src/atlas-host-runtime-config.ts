/** Runtime settings a deployed host loads before it loads any apps. */
export interface AtlasHostRuntimeConfig {
  /** Leave as "1". Atlas uses this to know how to read this runtime config file. */
  schemaVersion: '1';
  /** Host app using this runtime config. */
  hostId: string;
  /** Deployed host package version, when known. */
  hostVersion?: string;
  /** Full URL of the catalog JSON this host should load. */
  catalogUrl: string;
  /** Base URL serving artifact version indexes. Local development may expose a loopback proxy for a published registry. */
  registryUrl?: string;
  /** Maximum time Atlas waits for runtime resources, app loading, and app readiness. */
  resourcesTimeoutMs?: number;
  /** Number of retries after the first failed Atlas resource request. Defaults to three. */
  resourcesRetryCount?: number;
  /** HTTPS origins allowed to serve host-client artifacts, in addition to the catalog origin. */
  assetOrigins?: string[];
  /** Explicit external registries searched for app dependencies. Supplied by bootstrap configuration. */
  externalRegistryUrls?: string[];
}
