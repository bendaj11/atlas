import type { AtlasManifest } from "./atlas-manifest.js";
import { AtlasValidationError } from "./atlas-validation-error.js";
import { validateAtlasManifest } from "./validate-atlas-manifest.js";

/** Checks unknown JSON and throws if it is not a valid Atlas app manifest. */
export function assertAtlasManifest(value: unknown): asserts value is AtlasManifest {
  const issues = validateAtlasManifest(value);
  if (issues.length > 0) {
    throw new AtlasValidationError("Invalid Atlas manifest.", issues);
  }
}
