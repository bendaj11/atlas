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
  return issues;
}
