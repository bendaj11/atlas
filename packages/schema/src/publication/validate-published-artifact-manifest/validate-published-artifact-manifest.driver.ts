import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import {
  assertPublishedArtifactManifest,
  validatePublishedArtifactManifest,
} from './validate-published-artifact-manifest.js';

export class ValidatePublishedArtifactManifestDriver {
  private issues: AtlasValidationIssue[] = [];

  when = {
    validated: (value: unknown) => {
      this.issues = validatePublishedArtifactManifest(value);
    },
    asserted: (value: unknown) => {
      assertPublishedArtifactManifest(value);
    },
  };

  get = {
    issues: () => this.issues,
    issuePaths: () => this.issues.map((issue) => issue.path),
  };
}
