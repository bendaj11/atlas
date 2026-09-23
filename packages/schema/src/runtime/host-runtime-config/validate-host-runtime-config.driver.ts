import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import {
  assertAtlasHostRuntimeConfig,
  validateAtlasHostRuntimeConfig,
} from './validate-host-runtime-config.js';

export class ValidateHostRuntimeConfigDriver {
  private issues: AtlasValidationIssue[] = [];
  private error: unknown;

  readonly when = {
    validated: (value: unknown) => {
      this.issues = validateAtlasHostRuntimeConfig(value);
    },
    asserted: (value: unknown) => {
      try {
        assertAtlasHostRuntimeConfig(value);
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    issues: () => this.issues,
    issuePaths: () => this.issues.map((issue) => issue.path),
    error: () => this.error,
  };
}
