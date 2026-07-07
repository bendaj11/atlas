import type { AtlasMetadataValue } from "./atlas-metadata-value.js";

/** Extra simple values Atlas tools can read without app-specific parsing. */
export type AtlasMetadata = Record<string, AtlasMetadataValue>;
