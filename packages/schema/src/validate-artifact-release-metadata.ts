import type { AtlasValidationIssue } from "./atlas-validation-issue.js";
import { addIssue, type UnknownRecord } from "./validation.js";

const MAXIMUM_GIT_REFERENCE_LENGTH = 255;
const MAXIMUM_COMMIT_TITLE_LENGTH = 500;

export function validateArtifactReleaseMetadata(
  manifest: UnknownRecord | undefined,
  path: (field: string) => string,
  issues: AtlasValidationIssue[]
): void {
  validateOptionalText(manifest?.gitSha, path("gitSha"), MAXIMUM_GIT_REFERENCE_LENGTH, issues);
  validateOptionalText(manifest?.gitBranch, path("gitBranch"), MAXIMUM_GIT_REFERENCE_LENGTH, issues);
  validateOptionalText(manifest?.gitCommitTitle, path("gitCommitTitle"), MAXIMUM_COMMIT_TITLE_LENGTH, issues);

  if (manifest?.prNumber !== undefined
    && (!Number.isInteger(manifest.prNumber) || Number(manifest.prNumber) < 1)) {
    addIssue(issues, path("prNumber"), "Expected a positive integer pull request number.");
  }
}

function validateOptionalText(
  value: unknown,
  path: string,
  maximumLength: number,
  issues: AtlasValidationIssue[]
): void {
  if (value === undefined) return;
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maximumLength) {
    addIssue(issues, path, `Expected a non-empty string no longer than ${maximumLength} characters.`);
  }
}
