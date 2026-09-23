import type { AtlasManifest } from '../atlas-manifest.js';
import { assertNoIssues } from '../../validation/assert-valid.js';
import { ValidationIssues } from '../../validation/validation-issues.js';
import { collectAtlasManifestIssues } from '../validate-atlas-manifest/validate-atlas-manifest.js';

/** Checks unknown JSON and throws if it is not a valid Atlas app manifest. */
export function assertAtlasManifest(
  value: unknown,
): asserts value is AtlasManifest {
  const issues = ValidationIssues.create();
  collectAtlasManifestIssues({ value, issues });
  assertNoIssues({ issues, message: 'Invalid Atlas manifest.' });
}
