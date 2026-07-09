import type { AtlasValidationIssue } from "./atlas-validation-issue.js";

/** Error thrown when Atlas JSON is invalid. Includes every issue Atlas found. */
export class AtlasValidationError extends Error {
  /** All validation problems that caused this error. */
  readonly issues: AtlasValidationIssue[];

  constructor(message: string, issues: AtlasValidationIssue[]) {
    super(formatAtlasValidationMessage(message, issues));
    this.name = "AtlasValidationError";
    this.issues = issues;
  }
}

export function formatAtlasValidationMessage(message: string, issues: readonly AtlasValidationIssue[]): string {
  if (issues.length === 0) return message;

  const details = issues.map((issue) => `${issue.path}: ${issue.message}`).join(" ");
  return `${message} ${details}`;
}
