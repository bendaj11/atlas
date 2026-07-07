import type { AtlasDomIsolation } from "./atlas-dom-isolation.js";
import type { AtlasExportedComponentManifest } from "./atlas-exported-component-manifest.js";
import type { AtlasExposeMap } from "./atlas-expose-map.js";
import type { AtlasFramework } from "./atlas-framework.js";
import type { AtlasMetadata } from "./atlas-metadata.js";
import type { AtlasPlacement } from "./atlas-placement.js";
import type { AtlasStylesheet } from "./atlas-stylesheet.js";
import type { AtlasVersionChannel } from "./atlas-version-channel.js";

/** Complete description of one built app version that a host can load. */
export interface AtlasManifest {
  /** Leave as "1". Atlas uses this to know how to read this manifest file. */
  schemaVersion: "1";
  /** Short stable app id used in catalogs, config, and dependency references. */
  id: string;
  /** Friendly app name for tools, docs, and people. */
  name: string;
  /** App version in semver format, such as "1.2.3". */
  version: string;
  /** Unique id for this build output, usually from CI. */
  buildId: string;
  /** Tells Atlas whether this build is production, PR preview, historical, or local dev. */
  channel: AtlasVersionChannel;
  /** Framework this app was built with. */
  framework: AtlasFramework;
  /** CSS/DOM separation to use when the host renders this app. */
  isolation?: AtlasDomIsolation;
  /** Full URL of the JavaScript file the host loads to start this app. */
  remoteEntryUrl: string;
  /** CSS files the host should load before showing this app. */
  styles?: AtlasStylesheet[];
  /** Public modules this app exposes to the host. */
  exposes: AtlasExposeMap;
  /** Components or widgets this app publishes for other apps. */
  exportedComponents?: AtlasExportedComponentManifest[];
  /** Widgets this app needs from other apps, written as "app-id/widget-id". */
  uses?: string[];
  /** Host SDK version range this build expects, such as "^0.1.0". */
  requiredHostSdkVersion: string;
  /** Host app ids allowed to load this app. Use "*" to allow any host. */
  supportedHosts: string[];
  /** Pages or named host areas where this app may appear. */
  placements: AtlasPlacement[];
  /** Optional browser integrity check so Atlas can reject changed or corrupted JavaScript. */
  integrity?: string;
  /** Git commit used to produce this build. */
  gitSha?: string;
  /** Pull request number when this is a preview build. */
  prNumber?: number;
  /** Time this manifest was created, in ISO format. */
  createdAt: string;
  /** Extra simple values your tools can read. Keep values string, number, or boolean. */
  metadata?: AtlasMetadata;
}
