import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import { validateAtlasHostManifest } from './validate-atlas-host-manifest.js';

export class ValidateAtlasHostManifestDriver {
  private issues: AtlasValidationIssue[] = [];

  when = {
    validated: (value: unknown) => {
      this.issues = validateAtlasHostManifest(value);
    },
  };

  get = {
    issues: () => this.issues,
    issuePaths: () => this.issues.map((issue) => issue.path),
  };
}
