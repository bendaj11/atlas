import type { UnknownRecord } from './validators.js';
import { validateInteger, validateOptionalText } from './validators.js';
import type { ValidationIssues } from './validation-issues.js';

const MAXIMUM_GIT_REFERENCE_LENGTH = 255;
const MAXIMUM_COMMIT_TITLE_LENGTH = 500;

export function validateReleaseMetadata(input: {
  record: UnknownRecord | undefined;
  issues: ValidationIssues;
}): void {
  validateOptionalText({
    value: input.record?.gitSha,
    path: 'gitSha',
    maximumLength: MAXIMUM_GIT_REFERENCE_LENGTH,
    issues: input.issues,
  });
  validateOptionalText({
    value: input.record?.gitBranch,
    path: 'gitBranch',
    maximumLength: MAXIMUM_GIT_REFERENCE_LENGTH,
    issues: input.issues,
  });
  validateOptionalText({
    value: input.record?.gitCommitTitle,
    path: 'gitCommitTitle',
    maximumLength: MAXIMUM_COMMIT_TITLE_LENGTH,
    issues: input.issues,
  });
  if (input.record?.prNumber !== undefined)
    validateInteger({
      value: input.record.prNumber,
      path: 'prNumber',
      label: 'pull request number',
      minimum: 1,
      issues: input.issues,
    });
}
