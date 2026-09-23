import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import {
  ATLAS_DEPLOYMENT_SCHEMA_VERSION,
  type AtlasHostDeploymentManifest,
} from '../atlas-publication.js';
import { assertNoIssues } from '../../validation/assert-valid.js';
import { ValidationIssues } from '../../validation/validation-issues.js';
import {
  toRecord,
  requireLiteral,
  readRequiredString,
  readRequiredUrlSafePathSegment,
  validateHttpUrl,
  validateSha256Digest,
} from '../../validation/validators.js';
import { validateManifestDescriptor } from '../validate-manifest-descriptor/validate-manifest-descriptor.js';

/** Checks unknown JSON and returns all host deployment manifest problems. */
export function validateHostDeploymentManifest(
  value: unknown,
): AtlasValidationIssue[] {
  const issues = ValidationIssues.create();
  collectHostDeploymentManifestIssues({ value, issues });

  return issues.toArray();
}

/** Checks unknown JSON and throws unless it is a valid host deployment manifest. */
export function assertHostDeploymentManifest(
  value: unknown,
): asserts value is AtlasHostDeploymentManifest {
  const issues = ValidationIssues.create();
  collectHostDeploymentManifestIssues({ value, issues });
  assertNoIssues({
    issues,
    message: 'Invalid Atlas host deployment manifest.',
  });
}

function collectHostDeploymentManifestIssues(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  const { issues } = input;
  const manifest = toRecord(input.value);

  if (!manifest) {
    issues.add({
      path: '',
      message: 'Expected the host deployment manifest to be an object.',
    });

    return;
  }
  requireLiteral({
    record: manifest,
    key: 'schemaVersion',
    expected: ATLAS_DEPLOYMENT_SCHEMA_VERSION,
    issues,
  });
  requireLiteral({
    record: manifest,
    key: 'kind',
    expected: 'host-deployment',
    issues,
  });
  readRequiredUrlSafePathSegment({
    record: manifest,
    key: 'hostId',
    label: 'host id',
    issues,
  });
  readRequiredString({ record: manifest, key: 'environment', issues });
  validateSha256Digest({
    value: manifest.deploymentRevision,
    path: 'deploymentRevision',
    issues,
  });
  validateManifestReference({
    value: manifest.host,
    issues: issues.scopedTo('host'),
  });
  validateManifestReferences({
    value: manifest.apps,
    issues: issues.scopedTo('apps'),
  });
  if (manifest.widgetProviders !== undefined)
    validateManifestReferences({
      value: manifest.widgetProviders,
      issues: issues.scopedTo('widgetProviders'),
    });
}

function validateManifestReferences(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  if (!Array.isArray(input.value)) {
    input.issues.add({
      path: '',
      message: 'Expected an array of manifest references.',
    });

    return;
  }
  input.value.forEach((reference, index) =>
    validateManifestReference({
      value: reference,
      issues: input.issues.scopedTo(String(index)),
    }),
  );
}

function validateManifestReference(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  validateManifestDescriptor(input);
  const reference = toRecord(input.value);

  if (reference?.url === undefined) return;

  const url = readRequiredString({
    record: reference,
    key: 'url',
    issues: input.issues,
  });
  if (url) validateHttpUrl({ value: url, path: 'url', issues: input.issues });
}
