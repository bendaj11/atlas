import type { AtlasManifestDescriptor } from '../atlas-publication.js';
import { assertValid } from '../../validation/assert-valid.js';
import { ValidationIssues } from '../../validation/validation-issues.js';
import {
  asRecord,
  requiredLiteral,
  requiredSafeRelativePath,
  validateInteger,
  validateSha256Digest,
} from '../../validation/validators.js';

export function validateManifestDescriptor(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  const descriptor = asRecord(input.value);
  if (!descriptor) {
    input.issues.add({
      path: '',
      message: 'Expected manifest descriptor to be an object.',
    });

    return;
  }
  requiredSafeRelativePath({
    record: descriptor,
    key: 'path',
    issues: input.issues,
  });
  validateSha256Digest({
    value: descriptor.digest,
    path: 'digest',
    issues: input.issues,
  });
  validateInteger({
    value: descriptor.size,
    path: 'size',
    label: 'size',
    minimum: 1,
    issues: input.issues,
  });
  requiredLiteral({
    record: descriptor,
    key: 'mediaType',
    expected: 'application/json',
    issues: input.issues,
  });
}

/** Throws unless the value describes one published manifest file. */
export function assertManifestDescriptor(
  value: unknown,
  subject = 'manifest descriptor',
): asserts value is AtlasManifestDescriptor {
  const issues = ValidationIssues.create(subject);
  validateManifestDescriptor({ value, issues });
  assertValid({ issues, message: `Invalid Atlas ${subject}.` });
}
