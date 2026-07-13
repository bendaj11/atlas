import type { AtlasArtifactIndex } from "./atlas-artifact-index.js";
import type { AtlasAppManifest } from "./atlas-manifest.js";

/** Build history for one app, used by tooling and registries. */
export type AtlasAppIndex = AtlasArtifactIndex<AtlasAppManifest>;
