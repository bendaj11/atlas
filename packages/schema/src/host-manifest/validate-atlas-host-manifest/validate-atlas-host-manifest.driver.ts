import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import { validateAtlasHostManifest } from './validate-atlas-host-manifest.js';

export class ValidateAtlasHostManifestDriver {
  private issues: AtlasValidationIssue[] = [];

  when = {
    validated: (value: unknown): void => {
      this.issues = validateAtlasHostManifest(value);
    },
  };

  get = {
    issues: (): AtlasValidationIssue[] => this.issues,
    issuePaths: (): string[] => this.issues.map((issue) => issue.path),
  };
}
