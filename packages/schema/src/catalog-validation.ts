import type { AtlasValidationIssue } from "./atlas-validation-issue.js";
import { validateManifest } from "./manifest-validation.js";
import { validateAtlasHostManifest } from "./validate-atlas-host-manifest.js";
import { addIssue, asRecord, requiredString, validateIdentifier } from "./validation.js";

export function validateHostCatalog(value: unknown): AtlasValidationIssue[] {
  const issues: AtlasValidationIssue[] = [];
  const catalog = asRecord(value);
  requiredString(catalog, "schemaVersion", issues);
  const hostId = requiredString(catalog, "hostId", issues);
  if (hostId) validateIdentifier(hostId, "hostId", "host id", issues);
  requiredString(catalog, "generatedAt", issues);
  requiredString(catalog, "revision", issues);
  if (catalog?.schemaVersion !== "1") addIssue(issues, "schemaVersion", "Expected schemaVersion to be \"1\".");
  issues.push(...validateAtlasHostManifest(catalog?.host).map((issue) => ({ ...issue, path: `host.${issue.path}` })));
  const host = asRecord(catalog?.host);
  if (hostId && typeof host?.id === "string" && host.id !== hostId) addIssue(issues, "host.id", "Expected selected host id to match catalog hostId.");
  if (!Array.isArray(catalog?.apps)) {
    addIssue(issues, "apps", "Expected apps to be an array.");
    return issues;
  }

  catalog.apps.forEach((manifest, index) => issues.push(...validateManifest(manifest, `apps.${index}`)));
  validateUniqueManifestIds(catalog.apps, issues);
  if (catalog.widgetProviders !== undefined) {
    if (!Array.isArray(catalog.widgetProviders)) addIssue(issues, "widgetProviders", "Expected widgetProviders to be an array.");
    else {
      catalog.widgetProviders.forEach((manifest, index) => issues.push(...validateManifest(manifest, `widgetProviders.${index}`)));
      validateUniqueManifestIds(catalog.widgetProviders, issues, "widgetProviders");
    }
  }
  return issues;
}

function validateUniqueManifestIds(manifests: unknown[], issues: AtlasValidationIssue[], path = "apps"): void {
  const manifestIds = new Set<string>();
  manifests.forEach((manifestValue, manifestIndex) => {
    const manifest = asRecord(manifestValue);
    if (typeof manifest?.id !== "string") return;
    if (manifestIds.has(manifest.id)) {
      addIssue(issues, `${path}.${manifestIndex}.id`, `Duplicate app id "${manifest.id}".`);
    } else {
      manifestIds.add(manifest.id);
    }
  });
}
