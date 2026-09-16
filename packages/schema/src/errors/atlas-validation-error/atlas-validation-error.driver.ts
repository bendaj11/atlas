import type { AtlasValidationIssue } from '../atlas-validation-issue.js';
import { AtlasValidationError } from './atlas-validation-error.js';

export class AtlasValidationErrorDriver {
  private issues: AtlasValidationIssue[] = [];
  private error!: AtlasValidationError;

  given = {
    issues: (issues: AtlasValidationIssue[]): this => {
      this.issues = issues;

      return this;
    },
  };

  when = {
    constructed: (summary: string): void => {
      this.error = new AtlasValidationError(summary, this.issues);
    },
  };

  get = {
    error: (): AtlasValidationError => this.error,
  };
}
