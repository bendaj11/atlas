import type { AtlasValidationIssue } from '../errors/atlas-validation-issue.js';
import { assertValid } from './assert-valid.js';
import { ValidationIssues } from './validation-issues.js';

export class AssertValidDriver {
  private readonly issues = ValidationIssues.create();

  given = {
    issue: (issue: AtlasValidationIssue): this => {
      this.issues.add(issue);

      return this;
    },
  };

  when = {
    asserted: (message: string): void => {
      assertValid({ issues: this.issues, message });
    },
  };
}
