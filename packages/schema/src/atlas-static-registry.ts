import type { AtlasManifest } from "./atlas-manifest.js";
import type { AtlasHostManifest } from "./atlas-host-manifest.js";
import type { AtlasProductionSelection } from "./atlas-production-selection.js";

/** Registry file Atlas tooling reads to find available app builds. */
export interface AtlasStaticRegistry {
  /** Leave as "1". Atlas uses this to know how to read this registry file. */
  schemaVersion: "1";
  /** Hash of registry contents. Tools can use this to detect whether registry changed. */
  revision?: string;
  /** Time this registry was last updated, in ISO format. */
  updatedAt: string;
  /** All host-client builds known to this registry. */
  hosts: AtlasHostManifest[];
  /** All app builds known to this registry. */
  apps: AtlasManifest[];
  /** Explicit production selections for hosts and apps. */
  selections?: {
    hosts?: Record<string, AtlasProductionSelection>;
    apps?: Record<string, AtlasProductionSelection>;
  };
}
