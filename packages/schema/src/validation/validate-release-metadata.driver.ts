import { validateReleaseMetadata } from './validate-release-metadata.js';
import { ValidationIssues } from './validation-issues.js';
import type { UnknownRecord } from './validators.js';

export class ValidateReleaseMetadataDriver {
  private readonly issues = ValidationIssues.create();

  when = {
    validated: (record: UnknownRecord | undefined) => {
      validateReleaseMetadata({ record, issues: this.issues });
    },
  };

  get = {
    issues: () => this.issues.toArray(),
  };
}
