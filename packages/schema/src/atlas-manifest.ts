import type { AtlasArtifactManifestBase } from "./atlas-artifact-manifest-base.js";
import type { AtlasDomIsolation } from "./atlas-dom-isolation.js";
import type { AtlasExportedWidgetManifest } from "./atlas-exported-widget-manifest.js";
import type { AtlasExposeMap } from "./atlas-expose-map.js";
import type { AtlasMetadata } from "./atlas-metadata.js";
import type { AtlasPlacement } from "./atlas-placement.js";

/** Complete description of one built app version that a host can load. */
export interface AtlasAppManifest extends AtlasArtifactManifestBase {
  kind: "app";
  /** CSS/DOM separation to use when the host renders this app. */
  isolation?: AtlasDomIsolation;
  /** Public modules this app exposes to the host. */
  exposes: AtlasExposeMap;
  /** Widgets this app publishes for other apps. */
  exportedWidgets?: AtlasExportedWidgetManifest[];
  /** Apps in configured external registries whose exported widgets this app may load. */
  externalAppsDependencies?: string[];
  /** Host SDK version range this build expects, such as "^0.1.0". */
  requiredHostSdkVersion: string;
  /** Host ids allowed to load this app. Use "*" to allow any host. */
  supportedHosts: string[];
  /** Pages or named host areas where this app may appear. */
  placements: AtlasPlacement[];
  /** Extra simple values your tools can read. Keep values string, number, or boolean. */
  metadata?: AtlasMetadata;
}

/** Existing app-manifest name retained inside Atlas while host/app APIs converge. */
export type AtlasManifest = AtlasAppManifest;
