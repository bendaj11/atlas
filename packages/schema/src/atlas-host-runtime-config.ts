/** Runtime settings a deployed host loads before it loads any apps. */
export interface AtlasHostRuntimeConfig {
  /** Leave as "1". Atlas uses this to know how to read this runtime config file. */
  schemaVersion: '1';
  /** Host app using this runtime config. */
  hostId: string;
  /** Deployed host package version, when known. */
  hostVersion?: string;
  /** Full URL of environments/<environment>/hosts/<id>/manifest.json. */
  manifestUrl: string;
  /** Loopback-only ephemeral session used by the Atlas development control server. */
  developmentSessionUrl?: string;
  /** Logical environment selected by this host runtime. */
  environment: string;
  /** Base URL serving artifact version indexes. Local development may expose a loopback proxy for a published registry. */
  registryUrl?: string;
  /** Maximum time Atlas waits for runtime resources, app loading, and app readiness. */
  resourcesTimeoutMs?: number;
  /** Number of retries after the first failed Atlas resource request. Defaults to three. */
  resourcesRetryCount?: number;
  /** HTTPS origins allowed to serve host-client artifacts, in addition to the catalog origin. */
  assetOrigins?: string[];
  /** Explicit external registry environments searched for widget providers. */
  externalRegistries?: Array<{
    registryUrl: string;
    environment: string;
  }>;
}
