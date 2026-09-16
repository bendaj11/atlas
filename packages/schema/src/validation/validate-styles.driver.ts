import type { AtlasValidationIssue } from '../errors/atlas-validation-issue.js';
import { validateStyles } from './validate-styles.js';
import { ValidationIssues } from './validation-issues.js';

export class ValidateStylesDriver {
  private readonly issues = ValidationIssues.create('styles');

  when = {
    validated: (value: unknown): void => {
      validateStyles({ value, issues: this.issues });
    },
  };

  get = {
    issues: (): AtlasValidationIssue[] => this.issues.list(),
  };
}
