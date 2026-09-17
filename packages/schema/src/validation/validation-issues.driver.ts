import { ValidationIssues } from './validation-issues.js';

export class ValidationIssuesDriver {
  private prefix: string | undefined;
  private issues!: ValidationIssues;

  given = {
    prefix: (prefix: string | undefined) => {
      this.prefix = prefix;

      return this;
    },
  };

  when = {
    created: () => {
      this.issues = ValidationIssues.create(this.prefix);
    },
    added: (input: { path: string; message: string }) => {
      this.issues.add(input);
    },
    addedInScope: (scope: string, input: { path: string; message: string }) => {
      this.issues.scopedTo(scope).add(input);
    },
  };

  get = {
    issues: () => this.issues.toArray(),
  };
}
