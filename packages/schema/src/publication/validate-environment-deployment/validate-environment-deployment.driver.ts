import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import {
  assertEnvironmentDeployment,
  validateEnvironmentDeployment,
} from './validate-environment-deployment.js';

export class ValidateEnvironmentDeploymentDriver {
  private issues: AtlasValidationIssue[] = [];

  when = {
    validated: (value: unknown) => {
      this.issues = validateEnvironmentDeployment(value);
    },
    asserted: (value: unknown) => {
      assertEnvironmentDeployment(value);
    },
  };

  get = {
    issues: () => this.issues,
    issuePaths: () => this.issues.map((issue) => issue.path),
  };
}
