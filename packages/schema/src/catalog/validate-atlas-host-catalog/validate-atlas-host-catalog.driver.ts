import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import { validateAtlasHostCatalog } from './validate-atlas-host-catalog.js';

export class ValidateAtlasHostCatalogDriver {
  private issues: AtlasValidationIssue[] = [];

  when = {
    validated: (value: unknown): void => {
      this.issues = validateAtlasHostCatalog(value);
    },
  };

  get = {
    issues: (): AtlasValidationIssue[] => this.issues,
    issuePaths: (): string[] => this.issues.map((issue) => issue.path),
  };
}
