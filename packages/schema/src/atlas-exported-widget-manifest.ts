import type { AtlasFramework } from "./atlas-framework.js";
import type { AtlasMetadata } from "./atlas-metadata.js";

/** Widget this app makes available for other apps to use. */
export interface AtlasExportedWidgetManifest {
  /** Leave as "1". Atlas uses this to know how to read this widget record. */
  schemaVersion: "1";
  /** Short stable name consumers use to reference this widget. */
  id: string;
  /** Friendly widget name for tools, docs, and people. */
  name: string;
  /** App id that owns this widget. Must match the manifest's id. */
  ownerAppId: string;
  /** Framework this widget needs when another app renders it. */
  framework: AtlasFramework;
  /** Full URL of the built file that exposes this widget. */
  remoteEntryUrl: string;
  /** Public module name for this widget, such as "./widgets/product-count". */
  expose: string;
  /** Leave as "1". Atlas uses this to know how apps should consume this widget. */
  contractVersion: "1";
  /** Extra simple values your tools can read. Keep values string, number, or boolean. */
  metadata?: AtlasMetadata;
}
