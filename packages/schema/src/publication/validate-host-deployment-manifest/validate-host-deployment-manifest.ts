import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import type { AtlasHostDeploymentManifest } from '../atlas-publication.js';
import { assertValid } from '../../validation/assert-valid.js';
import { ValidationIssues } from '../../validation/validation-issues.js';
import {
  asRecord,
  requiredLiteral,
  requiredString,
  requiredUrlSafePathSegment,
  validateHttpUrl,
  validateSha256Digest,
} from '../../validation/validators.js';
import { validateManifestDescriptor } from '../validate-manifest-descriptor/validate-manifest-descriptor.js';

export const ATLAS_DEPLOYMENT_SCHEMA_VERSION = 'v1';

/** Checks unknown JSON and returns all host deployment manifest problems. */
export function validateHostDeploymentManifest(
  value: unknown,
): AtlasValidationIssue[] {
  const issues = ValidationIssues.create();
  collectHostDeploymentManifestIssues({ value, issues });

  return issues.list();
}

/** Checks unknown JSON and throws unless it is a valid host deployment manifest. */
export function assertHostDeploymentManifest(
  value: unknown,
): asserts value is AtlasHostDeploymentManifest {
  const issues = ValidationIssues.create();
  collectHostDeploymentManifestIssues({ value, issues });
  assertValid({ issues, message: 'Invalid Atlas host deployment manifest.' });
}

function collectHostDeploymentManifestIssues(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  const { issues } = input;
  const manifest = asRecord(input.value);
  if (!manifest) {
    issues.add({
      path: '',
      message: 'Expected the host deployment manifest to be an object.',
    });

    return;
  }
  requiredLiteral({
    record: manifest,
    key: 'schemaVersion',
    expected: ATLAS_DEPLOYMENT_SCHEMA_VERSION,
    issues,
  });
  requiredLiteral({
    record: manifest,
    key: 'kind',
    expected: 'host-deployment',
    issues,
  });
  requiredUrlSafePathSegment({
    record: manifest,
    key: 'hostId',
    label: 'host id',
    issues,
  });
  requiredString({ record: manifest, key: 'environment', issues });
  validateSha256Digest({
    value: manifest.deploymentRevision,
    path: 'deploymentRevision',
    issues,
  });
  validateManifestReference({
    value: manifest.host,
    issues: issues.at('host'),
  });
  validateManifestReferences({
    value: manifest.apps,
    issues: issues.at('apps'),
  });
  if (manifest.widgetProviders !== undefined)
    validateManifestReferences({
      value: manifest.widgetProviders,
      issues: issues.at('widgetProviders'),
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
      issues: input.issues.at(String(index)),
    }),
  );
}

function validateManifestReference(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  validateManifestDescriptor(input);
  const reference = asRecord(input.value);
  if (reference?.url === undefined) return;
  const url = requiredString({
    record: reference,
    key: 'url',
    issues: input.issues,
  });
  if (url) validateHttpUrl({ value: url, path: 'url', issues: input.issues });
}
