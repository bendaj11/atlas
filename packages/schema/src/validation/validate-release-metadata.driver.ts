import type { AtlasValidationIssue } from '../errors/atlas-validation-issue.js';
import { validateReleaseMetadata } from './validate-release-metadata.js';
import { ValidationIssues } from './validation-issues.js';
import type { UnknownRecord } from './validators.js';

export class ValidateReleaseMetadataDriver {
  private readonly issues = ValidationIssues.create();

  when = {
    validated: (record: UnknownRecord | undefined): void => {
      validateReleaseMetadata({ record, issues: this.issues });
    },
  };

  get = {
    issues: (): AtlasValidationIssue[] => this.issues.list(),
  };
}
