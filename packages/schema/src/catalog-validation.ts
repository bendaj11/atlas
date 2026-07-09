import type { AtlasValidationIssue } from "./atlas-validation-issue.js";
import { validateManifest } from "./manifest-validation.js";
import { addIssue, asRecord, requiredString, validateIdentifier } from "./validation.js";

export function validateHostCatalog(value: unknown): AtlasValidationIssue[] {
  const issues: AtlasValidationIssue[] = [];
  const catalog = asRecord(value);
  requiredString(catalog, "schemaVersion", issues);
  const hostId = requiredString(catalog, "hostId", issues);
  if (hostId) validateIdentifier(hostId, "hostId", "host id", issues);
  requiredString(catalog, "generatedAt", issues);
  if (catalog?.schemaVersion !== "1") addIssue(issues, "schemaVersion", "Expected schemaVersion to be \"1\".");
  if (!Array.isArray(catalog?.manifests)) {
    addIssue(issues, "manifests", "Expected manifests to be an array.");
    return issues;
  }

  catalog.manifests.forEach((manifest, index) => issues.push(...validateManifest(manifest, `manifests.${index}`)));
  validateUniqueManifestIds(catalog.manifests, issues);
  return issues;
}

function validateUniqueManifestIds(manifests: unknown[], issues: AtlasValidationIssue[]): void {
  const manifestIds = new Set<string>();
  manifests.forEach((manifestValue, manifestIndex) => {
    const manifest = asRecord(manifestValue);
    if (typeof manifest?.id !== "string") return;
    if (manifestIds.has(manifest.id)) {
      addIssue(issues, `manifests.${manifestIndex}.id`, `Duplicate app id "${manifest.id}".`);
    } else {
      manifestIds.add(manifest.id);
    }
  });
}
