import type { AtlasHostManifest } from "./atlas-host-manifest.js";
import { AtlasValidationError } from "./atlas-validation-error.js";
import { validateAtlasHostManifest } from "./validate-atlas-host-manifest.js";

/** Checks unknown JSON and throws unless it is a valid host-client manifest. */
export function assertAtlasHostManifest(value: unknown): asserts value is AtlasHostManifest {
  const issues = validateAtlasHostManifest(value);
  if (issues.length > 0) throw new AtlasValidationError("Invalid Atlas host manifest.", issues);
}
