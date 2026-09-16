import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import { collectAtlasHostManifestIssues } from '../../host-manifest/validate-atlas-host-manifest/validate-atlas-host-manifest.js';
import {
  ATLAS_MANIFEST_SCHEMA_VERSION,
  collectAtlasManifestIssues,
} from '../../manifest/validate-atlas-manifest/validate-atlas-manifest.js';
import { ValidationIssues } from '../../validation/validation-issues.js';
import {
  asRecord,
  requiredIdentifier,
  requiredLiteral,
  requiredString,
  validateUniqueValue,
} from '../../validation/validators.js';

/** Checks unknown JSON and returns all host catalog problems instead of throwing. */
export function validateAtlasHostCatalog(
  value: unknown,
): AtlasValidationIssue[] {
  const issues = ValidationIssues.create();
  collectAtlasHostCatalogIssues({ value, issues });

  return issues.list();
}

export function collectAtlasHostCatalogIssues(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  const { issues } = input;
  const catalog = asRecord(input.value);
  requiredLiteral({
    record: catalog,
    key: 'schemaVersion',
    expected: ATLAS_MANIFEST_SCHEMA_VERSION,
    issues,
  });
  const hostId = requiredIdentifier({
    record: catalog,
    key: 'hostId',
    label: 'host id',
    issues,
  });
  requiredString({ record: catalog, key: 'generatedAt', issues });
  requiredString({ record: catalog, key: 'revision', issues });
  collectAtlasHostManifestIssues({
    value: catalog?.host,
    issues: issues.at('host'),
  });
  const host = asRecord(catalog?.host);
  if (hostId && typeof host?.id === 'string' && host.id !== hostId)
    issues.add({
      path: 'host.id',
      message: 'Expected selected host id to match catalog hostId.',
    });
  validateManifestList({ value: catalog?.apps, issues: issues.at('apps') });
  if (catalog?.widgetProviders !== undefined)
    validateManifestList({
      value: catalog.widgetProviders,
      issues: issues.at('widgetProviders'),
    });
}

function validateManifestList(input: {
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
    const issues = input.issues.at(String(index));
    collectAtlasManifestIssues({ value: manifest, issues });
    const id = asRecord(manifest)?.id;
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
