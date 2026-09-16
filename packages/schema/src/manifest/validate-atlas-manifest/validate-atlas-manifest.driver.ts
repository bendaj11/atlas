import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import { validateAtlasManifest } from './validate-atlas-manifest.js';

export class ValidateAtlasManifestDriver {
  private issues: AtlasValidationIssue[] = [];

  when = {
    validated: (value: unknown): void => {
      this.issues = validateAtlasManifest(value);
    },
  };

  get = {
    issues: (): AtlasValidationIssue[] => this.issues,
    issuesAt: (path: string): AtlasValidationIssue[] =>
      this.issues.filter((issue) => issue.path === path),
    issuePaths: (): string[] => this.issues.map((issue) => issue.path),
  };
}
