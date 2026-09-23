import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import { validateAtlasManifest } from './validate-atlas-manifest.js';

export class ValidateAtlasManifestDriver {
  private issues: AtlasValidationIssue[] = [];

  when = {
    validated: (value: unknown) => {
      this.issues = validateAtlasManifest(value);
    },
  };

  get = {
    issues: () => this.issues,
    issuesAt: (path: string) =>
      this.issues.filter((issue) => issue.path === path),
    issuePaths: () => this.issues.map((issue) => issue.path),
  };
}
