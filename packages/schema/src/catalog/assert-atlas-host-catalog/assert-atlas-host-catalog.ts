import type { AtlasHostCatalog } from '../atlas-host-catalog.js';
import { assertValid } from '../../validation/assert-valid.js';
import { ValidationIssues } from '../../validation/validation-issues.js';
import { collectAtlasHostCatalogIssues } from '../validate-atlas-host-catalog/validate-atlas-host-catalog.js';

/** Checks unknown JSON and throws if it is not a valid host catalog. */
export function assertAtlasHostCatalog(
  value: unknown,
): asserts value is AtlasHostCatalog {
  const issues = ValidationIssues.create();
  collectAtlasHostCatalogIssues({ value, issues });
  assertValid({ issues, message: 'Invalid Atlas host catalog.' });
}
