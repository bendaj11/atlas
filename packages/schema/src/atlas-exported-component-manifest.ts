import type { AtlasFramework } from "./atlas-framework.js";
import type { AtlasMetadata } from "./atlas-metadata.js";

/** Component or widget this app makes available for other apps to use. */
export interface AtlasExportedComponentManifest {
  /** Leave as "1". Atlas uses this to know how to read this component record. */
  schemaVersion: "1";
  /** Short stable name consumers use to reference this component. */
  id: string;
  /** Friendly component name for tools, docs, and people. */
  name: string;
  /** App id that owns this component. Must match the manifest's id. */
  ownerMfId: string;
  /** Framework this component needs when another app renders it. */
  framework: AtlasFramework;
  /** Full URL of the built file that exposes this component. */
  remoteEntryUrl: string;
  /** Public module name for this component, such as "./Widget". */
  expose: string;
  /** Leave as "1". Atlas uses this to know how apps should consume this component. */
  contractVersion: "1";
  /** Extra simple values your tools can read. Keep values string, number, or boolean. */
  metadata?: AtlasMetadata;
}
