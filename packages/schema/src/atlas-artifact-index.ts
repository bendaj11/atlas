import type { AtlasAppManifest } from "./atlas-manifest.js";
import type { AtlasHostManifest } from "./atlas-host-manifest.js";

/** Build history for one host client or app. */
export interface AtlasArtifactIndex<TManifest extends AtlasHostManifest | AtlasAppManifest> {
  schemaVersion: "1";
  kind: TManifest["kind"];
  id: string;
  updatedAt: string;
  manifests: TManifest[];
}
