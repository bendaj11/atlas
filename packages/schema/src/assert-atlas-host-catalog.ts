import type { AtlasHostCatalog } from "./atlas-host-catalog.js";
import { AtlasValidationError } from "./atlas-validation-error.js";
import { validateAtlasHostCatalog } from "./validate-atlas-host-catalog.js";

/** Checks unknown JSON and throws if it is not a valid host catalog. */
export function assertAtlasHostCatalog(value: unknown): asserts value is AtlasHostCatalog {
  const issues = validateAtlasHostCatalog(value);
  if (issues.length > 0) throw new AtlasValidationError("Invalid Atlas host catalog.", issues);
}
