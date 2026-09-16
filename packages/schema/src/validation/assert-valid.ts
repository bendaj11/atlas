import { AtlasValidationError } from '../errors/atlas-validation-error/atlas-validation-error.js';
import type { ValidationIssues } from './validation-issues.js';

export function assertValid(input: {
  issues: ValidationIssues;
  message: string;
}): void {
  const issues = input.issues.list();
  if (issues.length > 0) throw new AtlasValidationError(input.message, issues);
}
