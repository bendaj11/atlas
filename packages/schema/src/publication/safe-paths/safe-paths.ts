import { assertValid } from '../../validation/assert-valid.js';
import { ValidationIssues } from '../../validation/validation-issues.js';
import {
  isNonEmptyString,
  validateSafeRelativePath,
  validateUrlSafePathSegment,
} from '../../validation/validators.js';

/** Throws unless the value is a non-empty URL-safe path segment. */
export function assertSafeArtifactId(
  value: unknown,
  subject = 'artifact id',
): asserts value is string {
  const issues = ValidationIssues.create();
  if (!isNonEmptyString(value))
    issues.add({
      path: subject,
      message: `Expected ${subject} to be a non-empty string.`,
    });
  else
    validateUrlSafePathSegment({
      value,
      path: subject,
      label: subject,
      issues,
    });
  assertValid({ issues, message: `Invalid Atlas ${subject}.` });
}

/** Throws unless the value is a relative path without traversal or URL-changing characters. */
export function assertSafeRelativePath(value: string, subject: string): void {
  const issues = ValidationIssues.create();
  validateSafeRelativePath({ value, path: subject, issues });
  assertValid({ issues, message: `Invalid Atlas ${subject}.` });
}
