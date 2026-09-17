import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import {
  ATLAS_DEPLOYMENT_SCHEMA_VERSION,
  type AtlasEnvironmentDeployment,
} from '../atlas-publication.js';
import { assertNoIssues } from '../../validation/assert-valid.js';
import { ValidationIssues } from '../../validation/validation-issues.js';
import {
  toRecord,
  requireLiteral,
  readRequiredString,
  validateSha256Digest,
  validateUrlSafePathSegment,
} from '../../validation/validators.js';
import { validateReleaseVersion } from '../release-version/release-version.js';

/** Checks unknown JSON and returns all environment deployment problems. */
export function validateEnvironmentDeployment(
  value: unknown,
): AtlasValidationIssue[] {
  const issues = ValidationIssues.create();
  collectEnvironmentDeploymentIssues({ value, issues });

  return issues.toArray();
}

/** Checks unknown JSON and throws unless it is a valid environment deployment. */
export function assertEnvironmentDeployment(
  value: unknown,
): asserts value is AtlasEnvironmentDeployment {
  const issues = ValidationIssues.create();
  collectEnvironmentDeploymentIssues({ value, issues });
  assertNoIssues({ issues, message: 'Invalid Atlas environment deployment.' });
}

function collectEnvironmentDeploymentIssues(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  const { issues } = input;
  const deployment = toRecord(input.value);

  if (!deployment) {
    issues.add({
      path: '',
      message: 'Expected the environment deployment to be an object.',
    });

    return;
  }
  requireLiteral({
    record: deployment,
    key: 'schemaVersion',
    expected: ATLAS_DEPLOYMENT_SCHEMA_VERSION,
    issues,
  });
  readRequiredString({ record: deployment, key: 'environment', issues });
  validateSha256Digest({
    value: deployment.revision,
    path: 'revision',
    issues,
  });
  const updatedAt = readRequiredString({
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
  validateDeploymentSelections({
    value: deployment.hosts,
    issues: issues.scopedTo('hosts'),
  });
  validateDeploymentSelections({
    value: deployment.apps,
    issues: issues.scopedTo('apps'),
  });
}

function validateDeploymentSelections(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  const selections = toRecord(input.value);

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
    const selection = toRecord(selectionValue);

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
