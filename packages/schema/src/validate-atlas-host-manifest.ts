import type { AtlasValidationIssue } from "./atlas-validation-issue.js";
import {
  addIssue,
  asRecord,
  isOneOf,
  requiredString,
  validateHttpUrl,
  validateIdentifier,
  validateSemanticVersion,
  validateSemanticVersionRange,
  validateSha256Integrity
} from "./validation.js";
import { validateArtifactReleaseMetadata } from "./validate-artifact-release-metadata.js";

/** Checks unknown JSON and returns all host-client manifest problems. */
export function validateAtlasHostManifest(value: unknown): AtlasValidationIssue[] {
  const issues: AtlasValidationIssue[] = [];
  const manifest = asRecord(value);
  for (const key of ["schemaVersion", "kind", "id", "name", "version", "buildId", "channel", "framework", "remoteEntryUrl", "requiredLoaderApiVersion", "createdAt"]) {
    requiredString(manifest, key, issues);
  }
  if (manifest?.schemaVersion !== "1") addIssue(issues, "schemaVersion", "Expected schemaVersion to be \"1\".");
  if (manifest?.kind !== "host") addIssue(issues, "kind", "Expected kind to be host.");
  if (!isOneOf(manifest?.channel, ["production", "pr", "local"])) addIssue(issues, "channel", "Expected channel to be production, pr, or local.");
  if (!isOneOf(manifest?.framework, ["angular", "react", "vue"])) addIssue(issues, "framework", "Expected framework to be angular, react, or vue.");
  validateIdentifier(manifest?.id, "id", "host id", issues);
  validateSemanticVersion(manifest?.version, "version", issues);
  validateSemanticVersionRange(manifest?.requiredLoaderApiVersion, "requiredLoaderApiVersion", issues);
  validateHttpUrl(manifest?.remoteEntryUrl, "remoteEntryUrl", issues);
  validateSha256Integrity(manifest?.integrity, "integrity", issues);
  validateArtifactReleaseMetadata(manifest, (field) => field, issues);
  const exposes = asRecord(manifest?.exposes);
  if (!exposes) addIssue(issues, "exposes", "Expected exposes to be an object.");
  else requiredString(exposes, "entry", issues, "exposes");
  validateHeadlessApps(manifest?.headlessApps, issues);
  return issues;
}

function validateHeadlessApps(value: unknown, issues: AtlasValidationIssue[]): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    addIssue(issues, "headlessApps", "Expected headlessApps to be an array.");
    return;
  }

  const ids = new Set<string>();
  const paths = new Set<string>();
  value.forEach((candidate, index) => {
    const path = `headlessApps.${index}`;
    const app = asRecord(candidate);
    const id = requiredString(app, "id", issues, path);
    const routePath = requiredString(app, "path", issues, path);
    if (id) {
      validateIdentifier(id, `${path}.id`, "headless app id", issues);
      if (ids.has(id)) addIssue(issues, `${path}.id`, `Duplicate headless app id "${id}".`);
      else ids.add(id);
    }
    if (routePath) {
      if (!routePath.startsWith("/") || routePath.includes("?") || routePath.includes("#"))
        addIssue(issues, `${path}.path`, "Expected an absolute route path without a query or fragment.");
      const normalizedPath = normalizePath(routePath);
      if (paths.has(normalizedPath)) addIssue(issues, `${path}.path`, `Duplicate headless app path "${normalizedPath}".`);
      else paths.add(normalizedPath);
    }
  });
}

function normalizePath(path: string): string {
  return path === "/" ? path : path.replace(/\/+$/, "");
}
