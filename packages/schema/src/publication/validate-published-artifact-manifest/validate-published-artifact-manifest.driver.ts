import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import {
  assertPublishedArtifactManifest,
  validatePublishedArtifactManifest,
} from './validate-published-artifact-manifest.js';

export class ValidatePublishedArtifactManifestDriver {
  private issues: AtlasValidationIssue[] = [];

  when = {
    validated: (value: unknown): void => {
      this.issues = validatePublishedArtifactManifest(value);
    },
    asserted: (value: unknown): void => {
      assertPublishedArtifactManifest(value);
    },
  };

  get = {
    issues: (): AtlasValidationIssue[] => this.issues,
    issuePaths: (): string[] => this.issues.map((issue) => issue.path),
  };
}
