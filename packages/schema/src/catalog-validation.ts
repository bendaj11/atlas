import type { AtlasValidationIssue } from "./atlas-validation-issue.js";
import { validateManifest } from "./manifest-validation.js";
import { addIssue, asRecord, requiredString, validateIdentifier } from "./validation.js";

interface RouteOwner {
  manifestId: string;
  path: string;
}

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
  validateExactRouteOwnership(catalog.manifests, issues);
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

function validateExactRouteOwnership(manifests: unknown[], issues: AtlasValidationIssue[]): void {
  const owners = new Map<string, RouteOwner>();
  manifests.forEach((manifestValue, manifestIndex) => {
    const manifest = asRecord(manifestValue);
    if (!Array.isArray(manifest?.placements)) return;
    manifest.placements.forEach((placementValue, placementIndex) => {
      const placement = asRecord(placementValue);
      const route = asRecord(placement?.route);
      if (placement?.kind !== "route" || typeof placement.hostId !== "string" || typeof route?.basePath !== "string") return;
      const path = `manifests.${manifestIndex}.placements.${placementIndex}.route.basePath`;
      const key = `${placement.hostId}\u0000${route.basePath}`;
      const previous = owners.get(key);
      if (previous) {
        addIssue(issues, path, `Route \"${route.basePath}\" for host \"${placement.hostId}\" is already owned by app \"${previous.manifestId}\" at ${previous.path}.`);
      } else {
        owners.set(key, { manifestId: typeof manifest?.id === "string" ? manifest.id : `manifest ${manifestIndex}`, path });
      }
    });
  });
}
