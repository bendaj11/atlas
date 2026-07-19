import type { AtlasAppConfig } from "./atlas-config.js";
import type { AtlasExportedWidgetManifest } from "./atlas-exported-widget-manifest.js";
import type { AtlasStylesheet } from "./atlas-stylesheet.js";
import type { AtlasVersionChannel } from "./atlas-version-channel.js";

/** Values needed to build the manifest JSON a host loads for one app build. */
export interface CreateManifestFromConfigInput {
  /** Developer-written Atlas config for the app. */
  config: AtlasAppConfig;
  /** App version to write into the manifest, such as "1.2.3". */
  version: string;
  /** Unique build id to write into the manifest. */
  buildId: string;
  /** Full URL of the JavaScript file the host will load. */
  remoteEntryUrl: string;
  /** Build kind for the manifest. Defaults to production. */
  channel?: AtlasVersionChannel;
  /** Git commit used for this build. */
  gitSha?: string;
  /** Git branch used for this build. */
  gitBranch?: string;
  /** First line of the Git commit message used for this build. */
  gitCommitTitle?: string;
  /** Pull request number when this is a preview build. */
  prNumber?: number;
  /** Creation time to write into the manifest. Defaults to now. */
  createdAt?: string;
  /** Widgets this app build publishes. */
  exportedWidgets?: AtlasExportedWidgetManifest[];
  /** CSS files this build produced. */
  styles?: AtlasStylesheet[];
  /** Browser integrity check for the generated JavaScript file. */
  integrity?: string;
}
