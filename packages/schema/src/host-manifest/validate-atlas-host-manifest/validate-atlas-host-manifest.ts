import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import { ATLAS_FRAMEWORKS } from '../../manifest/atlas-framework.js';
import { ATLAS_VERSION_CHANNELS } from '../../manifest/atlas-version-channel.js';
import { ATLAS_MANIFEST_SCHEMA_VERSION } from '../../manifest/validate-atlas-manifest/validate-atlas-manifest.js';
import { validateReleaseMetadata } from '../../validation/validate-release-metadata.js';
import { validateStyles } from '../../validation/validate-styles.js';
import { ValidationIssues } from '../../validation/validation-issues.js';
import {
  asRecord,
  requiredIdentifier,
  requiredLiteral,
  requiredOneOf,
  requiredString,
  validateHttpUrl,
  validateOptionalSha256Integrity,
  validateSemanticVersion,
  validateSemanticVersionRange,
} from '../../validation/validators.js';

/** Checks unknown JSON and returns all host-client manifest problems. */
export function validateAtlasHostManifest(
  value: unknown,
): AtlasValidationIssue[] {
  const issues = ValidationIssues.create();
  collectAtlasHostManifestIssues({ value, issues });

  return issues.list();
}

export function collectAtlasHostManifestIssues(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  const { issues } = input;
  const manifest = asRecord(input.value);
  requiredLiteral({
    record: manifest,
    key: 'schemaVersion',
    expected: ATLAS_MANIFEST_SCHEMA_VERSION,
    issues,
  });
  requiredLiteral({ record: manifest, key: 'kind', expected: 'host', issues });
  requiredIdentifier({ record: manifest, key: 'id', label: 'host id', issues });
  requiredString({ record: manifest, key: 'name', issues });
  requiredString({ record: manifest, key: 'buildId', issues });
  requiredString({ record: manifest, key: 'createdAt', issues });
  requiredOneOf({
    record: manifest,
    key: 'channel',
    allowed: ATLAS_VERSION_CHANNELS,
    issues,
  });
  requiredOneOf({
    record: manifest,
    key: 'framework',
    allowed: ATLAS_FRAMEWORKS,
    issues,
  });
  const version = requiredString({ record: manifest, key: 'version', issues });
  if (version)
    validateSemanticVersion({ value: version, path: 'version', issues });
  const loaderRange = requiredString({
    record: manifest,
    key: 'requiredLoaderApiVersion',
    issues,
  });
  if (loaderRange)
    validateSemanticVersionRange({
      value: loaderRange,
      path: 'requiredLoaderApiVersion',
      issues,
    });
  const remoteEntryUrl = requiredString({
    record: manifest,
    key: 'remoteEntryUrl',
    issues,
  });
  if (remoteEntryUrl)
    validateHttpUrl({ value: remoteEntryUrl, path: 'remoteEntryUrl', issues });
  validateOptionalSha256Integrity({
    value: manifest?.integrity,
    path: 'integrity',
    issues,
  });
  validateReleaseMetadata({ record: manifest, issues });
  validateStyles({ value: manifest?.styles, issues: issues.at('styles') });
  const exposes = asRecord(manifest?.exposes);
  if (!exposes) {
    issues.add({
      path: 'exposes',
      message: 'Expected exposes to be an object.',
    });

    return;
  }
  requiredString({
    record: exposes,
    key: 'entry',
    issues: issues.at('exposes'),
  });
}
