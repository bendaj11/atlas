import type { AtlasArtifactManifestBase } from "./atlas-artifact-manifest-base.js";
import type { AtlasExposeMap } from "./atlas-expose-map.js";
import type { AtlasHeadlessApp } from "./atlas-headless-app.js";

/** Complete description of one versioned host-client build. */
export interface AtlasHostManifest extends AtlasArtifactManifestBase {
  kind: "host";
  exposes: AtlasExposeMap;
  /** Loader API range this host client can mount under. */
  requiredLoaderApiVersion: string;
  /** Host-owned navigation targets that do not mount a remote app. */
  headlessApps?: AtlasHeadlessApp[];
}
