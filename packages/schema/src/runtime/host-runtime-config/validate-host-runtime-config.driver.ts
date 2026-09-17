import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import {
  assertAtlasRuntimeConfig,
  validateHostRuntimeConfig,
} from './validate-host-runtime-config.js';

export class ValidateHostRuntimeConfigDriver {
  private issues: AtlasValidationIssue[] = [];
  private error: unknown;

  readonly when = {
    validated: (value: unknown) => {
      this.issues = validateHostRuntimeConfig(value);
    },
    asserted: (value: unknown) => {
      try {
        assertAtlasRuntimeConfig(value);
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
