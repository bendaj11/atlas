import type { AtlasFramework } from "./atlas-framework.js";
import type { AtlasStylesheet } from "./atlas-stylesheet.js";
import type { AtlasVersionChannel } from "./atlas-version-channel.js";

/** Identity and immutable build metadata shared by host clients and apps. */
export interface AtlasArtifactManifestBase {
  schemaVersion: "1";
  kind: "host" | "app";
  id: string;
  name: string;
  version: string;
  buildId: string;
  channel: AtlasVersionChannel;
  framework: AtlasFramework;
  remoteEntryUrl: string;
  styles?: AtlasStylesheet[];
  integrity?: string;
  gitSha?: string;
  prNumber?: number;
  createdAt: string;
}
