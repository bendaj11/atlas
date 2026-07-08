import type { AtlasManifest } from "./atlas-manifest.js";

/** Build history for one app, used by tooling and registries. */
export interface AtlasAppIndex {
  /** Leave as "1". Atlas uses this to know how to read this index file. */
  schemaVersion: "1";
  /** App id this build history belongs to. */
  mfId: string;
  /** Time this build history was last updated, in ISO format. */
  updatedAt: string;
  /** Known builds for this app across production, previews, old builds, and local dev. */
  manifests: AtlasManifest[];
}

/** @deprecated Use AtlasAppIndex. */
export type AtlasMicrofrontendIndex = AtlasAppIndex;
