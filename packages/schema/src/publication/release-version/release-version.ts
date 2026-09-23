import { assertNoIssues } from '../../validation/assert-valid.js';
import { ValidationIssues } from '../../validation/validation-issues.js';
import {
  isNonEmptyString,
  validateUrlSafePathSegment,
} from '../../validation/validators.js';

export const ATLAS_LATEST_RELEASE = 'latest';

export function validateReleaseVersion(input: {
  value: unknown;
  path: string;
  issues: ValidationIssues;
}): boolean {
  if (!isNonEmptyString(input.value)) {
    input.issues.add({
      path: input.path,
      message: 'Expected release version to be a non-empty string.',
    });

    return false;
  }
  if (input.value === ATLAS_LATEST_RELEASE) {
    input.issues.add({
      path: input.path,
      message: `Expected release version to be a concrete version, "${ATLAS_LATEST_RELEASE}" is reserved.`,
    });

    return false;
  }

  return validateUrlSafePathSegment({
    value: input.value,
    path: input.path,
    label: 'release version',
    issues: input.issues,
  });
}

/** Throws unless the value is a concrete, URL-safe release version. */
export function assertReleaseVersion(value: unknown): asserts value is string {
  const issues = ValidationIssues.create();
  validateReleaseVersion({ value, path: 'release.version', issues });
  assertNoIssues({ issues, message: 'Invalid Atlas release version.' });
}
