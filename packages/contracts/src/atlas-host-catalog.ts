import type { AtlasManifest } from "./atlas-manifest.js";

/** List of app builds one host should load for a specific runtime. */
export interface AtlasHostCatalog {
  /** Leave as "1". Atlas uses this to know how to read this catalog file. */
  schemaVersion: "1";
  /** Host app this catalog belongs to. */
  hostId: string;
  /** Time this catalog was generated, in ISO format. */
  generatedAt: string;
  /** App builds the host should load. */
  manifests: AtlasManifest[];
}
