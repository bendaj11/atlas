/** Runtime settings a deployed host loads before it loads any apps. */
export interface AtlasHostRuntimeConfig {
  /** Leave as "1". Atlas uses this to know how to read this runtime config file. */
  schemaVersion: "1";
  /** Host app using this runtime config. */
  hostId: string;
  /** Full URL of the catalog JSON this host should load. */
  catalogUrl: string;
  /** Allow Atlas tools to override selected app manifests at runtime. Defaults to true. */
  allowAppOverrides?: boolean;
  /** Maximum time Atlas waits for runtime resources, app loading, and app readiness. */
  resourcesTimeoutMs?: number;
  /** Number of retries after the first failed Atlas resource request. Defaults to three. */
  resourcesRetryCount?: number;
}
