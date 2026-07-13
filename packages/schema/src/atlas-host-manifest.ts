import type { AtlasArtifactManifestBase } from "./atlas-artifact-manifest-base.js";
import type { AtlasExposeMap } from "./atlas-expose-map.js";

/** Complete description of one versioned host-client build. */
export interface AtlasHostManifest extends AtlasArtifactManifestBase {
  kind: "host";
  exposes: AtlasExposeMap;
  /** Loader API range this host client can mount under. */
  requiredLoaderApiVersion: string;
}
