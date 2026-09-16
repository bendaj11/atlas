import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import {
  assertHostDeploymentManifest,
  validateHostDeploymentManifest,
} from './validate-host-deployment-manifest.js';

export class ValidateHostDeploymentManifestDriver {
  private issues: AtlasValidationIssue[] = [];

  when = {
    validated: (value: unknown): void => {
      this.issues = validateHostDeploymentManifest(value);
    },
    asserted: (value: unknown): void => {
      assertHostDeploymentManifest(value);
    },
  };

  get = {
    issues: (): AtlasValidationIssue[] => this.issues,
    issuePaths: (): string[] => this.issues.map((issue) => issue.path),
  };
}
