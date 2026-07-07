import type { AtlasValidationIssue } from "./atlas-validation-issue.js";

export type UnknownRecord = Record<string, unknown>;

const SEMANTIC_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?$/;
const SEMANTIC_VERSION_RANGE = /^(?:[*xX]|(?:[~^]|[<>]=?|=)?\s*(?:\d+|[xX*])(?:\.(?:\d+|[xX*])){0,2}(?:-[0-9A-Za-z.-]+)?)(?:\s*(?:-\s*|\|\|\s*|\s+)(?:[~^]|[<>]=?|=)?\s*(?:\d+|[xX*])(?:\.(?:\d+|[xX*])){0,2}(?:-[0-9A-Za-z.-]+)?)*$/;
const SHA_256_INTEGRITY = /^sha256-[A-Za-z0-9+/]{43}=$/;
const SAFE_IDENTIFIER = /^[A-Za-z0-9](?:[A-Za-z0-9_-]|\.(?=[A-Za-z0-9_-]))*$/;

export function asRecord(value: unknown): UnknownRecord | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as UnknownRecord;
}

export function addIssue(issues: AtlasValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

export function requiredString(
  record: UnknownRecord | undefined,
  key: string,
  issues: AtlasValidationIssue[],
  prefix?: string
): string | undefined {
  const value = record?.[key];
  if (typeof value !== "string" || value.trim() === "") {
    addIssue(issues, joinPath(prefix, key), `Expected ${key} to be a non-empty string.`);
    return undefined;
  }
  return value;
}

export function validateIdentifier(value: unknown, path: string, label: string, issues: AtlasValidationIssue[]): value is string {
  if (typeof value === "string" && value.trim() !== "" && !SAFE_IDENTIFIER.test(value)) {
    addIssue(issues, path, `Expected ${label} to contain only letters, numbers, dots, dashes, and underscores, without traversal.`);
    return false;
  }
  return typeof value === "string" && value.trim() !== "";
}

export function validateHttpUrl(value: unknown, path: string, issues: AtlasValidationIssue[]): void {
  if (typeof value !== "string" || value.trim() === "") return;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported protocol");
  } catch {
    addIssue(issues, path, "Expected an absolute HTTP(S) URL.");
  }
}

export function validateSemanticVersion(value: unknown, path: string, issues: AtlasValidationIssue[]): void {
  if (typeof value === "string" && value.trim() !== "" && !SEMANTIC_VERSION.test(value)) {
    addIssue(issues, path, "Expected a semantic version such as 1.2.3.");
  }
}

export function validateSemanticVersionRange(value: unknown, path: string, issues: AtlasValidationIssue[]): void {
  if (typeof value === "string" && value.trim() !== "" && !SEMANTIC_VERSION_RANGE.test(value)) {
    addIssue(issues, path, "Expected a semantic version range such as ^1.2.3.");
  }
}

export function validateSha256Integrity(value: unknown, path: string, issues: AtlasValidationIssue[]): void {
  if (value !== undefined && (typeof value !== "string" || !SHA_256_INTEGRITY.test(value))) {
    addIssue(issues, path, "Expected SHA-256 integrity in SRI format.");
  }
}

export function validateMetadata(value: unknown, path: string, issues: AtlasValidationIssue[]): void {
  if (value === undefined) return;
  const metadata = asRecord(value);
  if (!metadata) {
    addIssue(issues, path, "Expected metadata to be an object.");
    return;
  }
  for (const [key, entry] of Object.entries(metadata)) {
    if (!isMetadataValue(entry)) addIssue(issues, `${path}.${key}`, "Expected a string, number, or boolean metadata value.");
  }
}

export function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

export function joinPath(prefix: string | undefined, path: string): string {
  return prefix ? `${prefix}.${path}` : path;
}

function isMetadataValue(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value));
}
