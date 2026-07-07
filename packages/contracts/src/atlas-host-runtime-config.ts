import type { AtlasLoadingIndicator } from "./atlas-loading-indicator.js";

/** Runtime settings a deployed host loads before it loads any apps. */
export interface AtlasHostRuntimeConfig {
  /** Leave as "1". Atlas uses this to know how to read this runtime config file. */
  schemaVersion: "1";
  /** Host app using this runtime config. */
  hostId: string;
  /** Full URL of the catalog JSON this host should load. */
  catalogUrl: string;
  /** Extra domains this host may load remote app files from. Catalog domain is always allowed. */
  allowedRemoteOrigins?: string[];
  /** Require integrity hashes for remote files outside local dev. Defaults to true. */
  requireIntegrity?: boolean;
  /** Allow dev tools to override catalog or remote URLs at runtime. Defaults to false. */
  allowRuntimeOverrides?: boolean;
  /** Maximum time to wait for runtime config, catalog, override, and remote-file requests. */
  requestTimeoutMs?: number;
  /** Number of retry attempts after the first failed runtime request. Defaults to two. */
  retryAttempts?: number;
  /** Delay between retry attempts for runtime requests. */
  retryDelayMs?: number;
  /** Maximum time to wait while loading one remote app. */
  loadTimeoutMs?: number;
  /** Keep loading UI visible until the remote app says it is ready. */
  waitForMfReady?: boolean;
  /** Loading UI style the host shows while remote apps load. */
  loadingIndicator?: AtlasLoadingIndicator;
}
