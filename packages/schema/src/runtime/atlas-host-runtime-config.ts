/** Runtime settings a deployed host loads before it loads any apps. */
export interface AtlasHostRuntimeConfig {
  /** Leave as "v1". Atlas uses this to know how to read this runtime config file. */
  schemaVersion: 'v1';
  hostId: string;
  hostVersion?: string;
  environment: string;
  artifactRegistryUrl: string;
  environmentRegistryUrl?: string;
  /** Development-only runtime controls. Production atlas.runtime.json rejects these. */
  resourcesTimeoutMs?: number;
  resourcesRetryCount?: number;
  /** @deprecated Compatibility-only fields. Production atlas.runtime.json rejects these. */
  manifestUrl?: string;
  developmentSessionUrl?: string;
  registryUrl?: string;
  assetOrigins?: string[];
}
