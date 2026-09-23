import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import { collectAtlasHostManifestIssues } from '../../host-manifest/validate-atlas-host-manifest/validate-atlas-host-manifest.js';
import { ATLAS_MANIFEST_SCHEMA_VERSION } from '../../manifest/atlas-artifact-manifest-base.js';
import { collectAtlasManifestIssues } from '../../manifest/validate-atlas-manifest/validate-atlas-manifest.js';
import { ValidationIssues } from '../../validation/validation-issues.js';
import {
  toRecord,
  readRequiredIdentifier,
  requireLiteral,
  readRequiredString,
  validateUniqueValue,
} from '../../validation/validators.js';

/** Checks unknown JSON and returns all host catalog problems instead of throwing. */
export function validateAtlasHostCatalog(
  value: unknown,
): AtlasValidationIssue[] {
  const issues = ValidationIssues.create();
  collectAtlasHostCatalogIssues({ value, issues });

  return issues.toArray();
}

export function collectAtlasHostCatalogIssues(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  const { issues } = input;
  const catalog = toRecord(input.value);
  requireLiteral({
    record: catalog,
    key: 'schemaVersion',
    expected: ATLAS_MANIFEST_SCHEMA_VERSION,
    issues,
  });
  const hostId = readRequiredIdentifier({
    record: catalog,
    key: 'hostId',
    label: 'host id',
    issues,
  });
  readRequiredString({ record: catalog, key: 'generatedAt', issues });
  readRequiredString({ record: catalog, key: 'revision', issues });
  collectAtlasHostManifestIssues({
    value: catalog?.host,
    issues: issues.scopedTo('host'),
  });
  const host = toRecord(catalog?.host);

  if (hostId && typeof host?.id === 'string' && host.id !== hostId)
    issues.add({
      path: 'host.id',
      message: 'Expected selected host id to match catalog hostId.',
    });
  validateAppManifestList({
    value: catalog?.apps,
    issues: issues.scopedTo('apps'),
  });
  if (catalog?.widgetProviders !== undefined)
    validateAppManifestList({
      value: catalog.widgetProviders,
      issues: issues.scopedTo('widgetProviders'),
    });
}

function validateAppManifestList(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  if (!Array.isArray(input.value)) {
    input.issues.add({
      path: '',
      message: 'Expected an array of app manifests.',
    });

    return;
  }
  const ids = new Set<string>();
  input.value.forEach((manifest, index) => {
    const issues = input.issues.scopedTo(String(index));
    collectAtlasManifestIssues({ value: manifest, issues });
    const id = toRecord(manifest)?.id;

    if (typeof id === 'string')
      validateUniqueValue({
        value: id,
        path: 'id',
        label: 'app id',
        seen: ids,
        issues,
      });
  });
}
