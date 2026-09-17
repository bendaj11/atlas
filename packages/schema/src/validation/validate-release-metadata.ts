import type { UnknownRecord } from './validators.js';
import {
  validateIntegerAtLeast,
  validateOptionalBoundedText,
} from './validators.js';
import type { ValidationIssues } from './validation-issues.js';

const MAXIMUM_GIT_REFERENCE_LENGTH = 255;
const MAXIMUM_COMMIT_TITLE_LENGTH = 500;

export function validateReleaseMetadata(input: {
  record: UnknownRecord | undefined;
  issues: ValidationIssues;
}): void {
  validateOptionalBoundedText({
    value: input.record?.gitSha,
    path: 'gitSha',
    maximumLength: MAXIMUM_GIT_REFERENCE_LENGTH,
    issues: input.issues,
  });
  validateOptionalBoundedText({
    value: input.record?.gitBranch,
    path: 'gitBranch',
    maximumLength: MAXIMUM_GIT_REFERENCE_LENGTH,
    issues: input.issues,
  });
  validateOptionalBoundedText({
    value: input.record?.gitCommitTitle,
    path: 'gitCommitTitle',
    maximumLength: MAXIMUM_COMMIT_TITLE_LENGTH,
    issues: input.issues,
  });
  if (input.record?.prNumber !== undefined)
    validateIntegerAtLeast({
      value: input.record.prNumber,
      path: 'prNumber',
      label: 'pull request number',
      minimum: 1,
      issues: input.issues,
    });
}
