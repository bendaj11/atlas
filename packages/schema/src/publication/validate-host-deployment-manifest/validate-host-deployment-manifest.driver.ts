import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import {
  assertHostDeploymentManifest,
  validateHostDeploymentManifest,
} from './validate-host-deployment-manifest.js';

export class ValidateHostDeploymentManifestDriver {
  private issues: AtlasValidationIssue[] = [];

  when = {
    validated: (value: unknown) => {
      this.issues = validateHostDeploymentManifest(value);
    },
    asserted: (value: unknown) => {
      assertHostDeploymentManifest(value);
    },
  };

  get = {
    issues: () => this.issues,
    issuePaths: () => this.issues.map((issue) => issue.path),
  };
}
