import { validateStyles } from './validate-styles.js';
import { ValidationIssues } from './validation-issues.js';

export class ValidateStylesDriver {
  private readonly issues = ValidationIssues.create('styles');

  when = {
    validated: (value: unknown) => {
      validateStyles({ value, issues: this.issues });
    },
  };

  get = {
    issues: () => this.issues.toArray(),
  };
}
