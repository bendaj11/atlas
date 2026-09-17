import type { AtlasValidationIssue } from '../errors/atlas-validation-issue.js';
import { assertNoIssues } from './assert-valid.js';
import { ValidationIssues } from './validation-issues.js';

export class AssertValidDriver {
  private readonly issues = ValidationIssues.create();

  given = {
    issue: (issue: AtlasValidationIssue) => {
      this.issues.add(issue);

      return this;
    },
  };

  when = {
    asserted: (message: string) => {
      assertNoIssues({ issues: this.issues, message });
    },
  };
}
