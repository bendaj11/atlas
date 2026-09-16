import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import type { AtlasEnvironmentDeployment } from '../atlas-publication.js';
import { assertValid } from '../../validation/assert-valid.js';
import { ValidationIssues } from '../../validation/validation-issues.js';
import {
  asRecord,
  requiredLiteral,
  requiredString,
  validateSha256Digest,
  validateUrlSafePathSegment,
} from '../../validation/validators.js';
import { validateReleaseVersion } from '../release-version/release-version.js';
import { ATLAS_DEPLOYMENT_SCHEMA_VERSION } from '../validate-host-deployment-manifest/validate-host-deployment-manifest.js';

/** Checks unknown JSON and returns all environment deployment problems. */
export function validateEnvironmentDeployment(
  value: unknown,
): AtlasValidationIssue[] {
  const issues = ValidationIssues.create();
  collectEnvironmentDeploymentIssues({ value, issues });

  return issues.list();
}

/** Checks unknown JSON and throws unless it is a valid environment deployment. */
export function assertEnvironmentDeployment(
  value: unknown,
): asserts value is AtlasEnvironmentDeployment {
  const issues = ValidationIssues.create();
  collectEnvironmentDeploymentIssues({ value, issues });
  assertValid({ issues, message: 'Invalid Atlas environment deployment.' });
}

function collectEnvironmentDeploymentIssues(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  const { issues } = input;
  const deployment = asRecord(input.value);
  if (!deployment) {
    issues.add({
      path: '',
      message: 'Expected the environment deployment to be an object.',
    });

    return;
  }
  requiredLiteral({
    record: deployment,
    key: 'schemaVersion',
    expected: ATLAS_DEPLOYMENT_SCHEMA_VERSION,
    issues,
  });
  requiredString({ record: deployment, key: 'environment', issues });
  validateSha256Digest({
    value: deployment.revision,
    path: 'revision',
    issues,
  });
  const updatedAt = requiredString({
    record: deployment,
    key: 'updatedAt',
    issues,
  });
  if (updatedAt && !isIsoDateTime(updatedAt))
    issues.add({
      path: 'updatedAt',
      message:
        'Expected updatedAt to be an ISO date-time such as 2026-01-01T00:00:00.000Z.',
    });
  validateSelections({ value: deployment.hosts, issues: issues.at('hosts') });
  validateSelections({ value: deployment.apps, issues: issues.at('apps') });
}

function validateSelections(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  const selections = asRecord(input.value);
  if (!selections) {
    input.issues.add({
      path: '',
      message: 'Expected an object keyed by artifact id.',
    });

    return;
  }
  for (const [id, selectionValue] of Object.entries(selections)) {
    validateUrlSafePathSegment({
      value: id,
      path: id,
      label: 'artifact id',
      issues: input.issues,
    });
    const selection = asRecord(selectionValue);
    if (!selection) {
      input.issues.add({
        path: id,
        message: 'Expected a selection object with a version.',
      });
      continue;
    }
    validateReleaseVersion({
      value: selection.version,
      path: `${id}.version`,
      issues: input.issues,
    });
  }
}

function isIsoDateTime(value: string): boolean {
  const date = new Date(value);

  return !Number.isNaN(date.valueOf()) && date.toISOString() === value;
}
