import type { AtlasValidationIssue } from '../errors/atlas-validation-issue.js';
import { ValidationIssues } from './validation-issues.js';

export class ValidationIssuesDriver {
  private prefix: string | undefined;
  private issues!: ValidationIssues;

  given = {
    prefix: (prefix: string | undefined): this => {
      this.prefix = prefix;

      return this;
    },
  };

  when = {
    created: (): void => {
      this.issues = ValidationIssues.create(this.prefix);
    },
    added: (input: { path: string; message: string }): void => {
      this.issues.add(input);
    },
    addedAt: (
      scope: string,
      input: { path: string; message: string },
    ): void => {
      this.issues.at(scope).add(input);
    },
  };

  get = {
    list: (): AtlasValidationIssue[] => this.issues.list(),
  };
}
