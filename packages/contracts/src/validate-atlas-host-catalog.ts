import type { AtlasValidationIssue } from "./atlas-validation-issue.js";
import { validateHostCatalog } from "./catalog-validation.js";

/** Checks unknown JSON and returns all host catalog problems instead of throwing. */
export function validateAtlasHostCatalog(value: unknown): AtlasValidationIssue[] {
  return validateHostCatalog(value);
}
