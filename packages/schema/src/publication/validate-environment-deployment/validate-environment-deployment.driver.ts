import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import {
  assertEnvironmentDeployment,
  validateEnvironmentDeployment,
} from './validate-environment-deployment.js';

export class ValidateEnvironmentDeploymentDriver {
  private issues: AtlasValidationIssue[] = [];

  when = {
    validated: (value: unknown): void => {
      this.issues = validateEnvironmentDeployment(value);
    },
    asserted: (value: unknown): void => {
      assertEnvironmentDeployment(value);
    },
  };

  get = {
    issues: (): AtlasValidationIssue[] => this.issues,
    issuePaths: (): string[] => this.issues.map((issue) => issue.path),
  };
}
