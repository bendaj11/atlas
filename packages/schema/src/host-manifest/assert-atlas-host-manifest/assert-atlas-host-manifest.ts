import type { AtlasHostManifest } from '../atlas-host-manifest.js';
import { assertValid } from '../../validation/assert-valid.js';
import { ValidationIssues } from '../../validation/validation-issues.js';
import { collectAtlasHostManifestIssues } from '../validate-atlas-host-manifest/validate-atlas-host-manifest.js';

/** Checks unknown JSON and throws unless it is a valid host-client manifest. */
export function assertAtlasHostManifest(
  value: unknown,
): asserts value is AtlasHostManifest {
  const issues = ValidationIssues.create();
  collectAtlasHostManifestIssues({ value, issues });
  assertValid({ issues, message: 'Invalid Atlas host manifest.' });
}
