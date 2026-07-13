import type { AtlasManifest } from "./atlas-manifest.js";
import type { AtlasHostManifest } from "./atlas-host-manifest.js";

/** List of app builds one host should load for a specific runtime. */
export interface AtlasHostCatalog {
  /** Leave as "1". Atlas uses this to know how to read this catalog file. */
  schemaVersion: "1";
  /** Host app this catalog belongs to. */
  hostId: string;
  /** Canonical hash of the complete selected deployment. */
  revision: string;
  /** Time this catalog was generated, in ISO format. */
  generatedAt: string;
  /** Host-client build the loader mounts. */
  host: AtlasHostManifest;
  /** App builds the host client mounts. */
  apps: AtlasManifest[];
  /** Optional runtime overrides for widget-only provider apps. Never mounted as routed or slotted apps. */
  widgetProviders?: AtlasManifest[];
}

export type AtlasDeploymentCatalog = AtlasHostCatalog;
