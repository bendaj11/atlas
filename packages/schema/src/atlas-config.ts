import type { AtlasDomIsolation } from "./atlas-dom-isolation.js";
import type { AtlasFramework } from "./atlas-framework.js";
import type { AtlasHostRuntimeConfig } from "./atlas-host-runtime-config.js";
import type { AtlasPlacement } from "./atlas-placement.js";

/** Source config developers write so Atlas can build manifests and runtime files. */
export interface AtlasConfig {
  /** Short stable app or host id used in generated Atlas files. */
  id: string;
  /** Friendly display name. Defaults to id. */
  name?: string;
  /** Framework this app is built with. */
  framework: AtlasFramework;
  /** CSS/DOM separation to request when a host renders this app. Defaults to scoped. */
  isolation?: AtlasDomIsolation;
  /** Host app ids this app supports. Defaults to all hosts. */
  hostCompatibility?: string[];
  /** Pages or named host areas this app wants to appear in. */
  placements?: AtlasPlacement[];
  /** Widgets this app needs from other apps. Atlas adds those owner apps to the host catalog. */
  uses?: string[];
  /** Catalog URL for host projects or local tooling. */
  catalogUrl?: string;
  /** Host defaults Atlas writes into atlas.runtime.json for deployed runtime loading. */
  runtime?: Partial<Omit<AtlasHostRuntimeConfig, "schemaVersion" | "hostId">>;
  /** Host SDK version range generated manifests should require. */
  requiredHostSdkVersion?: string;
}
