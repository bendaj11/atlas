import type { AtlasValidationIssue } from "./atlas-validation-issue.js";

/** Error thrown when Atlas JSON is invalid. Includes every issue Atlas found. */
export class AtlasValidationError extends Error {
  /** All validation problems that caused this error. */
  readonly issues: AtlasValidationIssue[];

  constructor(message: string, issues: AtlasValidationIssue[]) {
    super(message);
    this.name = "AtlasValidationError";
    this.issues = issues;
  }
}
