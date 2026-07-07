import { validateManifest } from "./manifest-validation.js";
import type { AtlasValidationIssue } from "./atlas-validation-issue.js";

/** Checks unknown JSON and returns all app manifest problems instead of throwing. */
export function validateAtlasManifest(value: unknown): AtlasValidationIssue[] {
  return validateManifest(value);
}
