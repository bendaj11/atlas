import { formatAlternatives } from './format-list.js';
import type { ValidationIssues } from './validation-issues.js';

export type UnknownRecord = Record<string, unknown>;

const SEMANTIC_VERSION =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?$/;
const SEMANTIC_VERSION_RANGE =
  /^(?:[*xX]|(?:[~^]|[<>]=?|=)?\s*(?:\d+|[xX*])(?:\.(?:\d+|[xX*])){0,2}(?:-[0-9A-Za-z.-]+)?)(?:\s*(?:-\s*|\|\|\s*|\s+)(?:[~^]|[<>]=?|=)?\s*(?:\d+|[xX*])(?:\.(?:\d+|[xX*])){0,2}(?:-[0-9A-Za-z.-]+)?)*$/;
const SHA_256_INTEGRITY = /^sha256-[A-Za-z0-9+/]{43}=$/;
const SHA_256_DIGEST = /^sha256:[0-9a-f]{64}$/u;
const SAFE_IDENTIFIER = /^[A-Za-z0-9](?:[A-Za-z0-9_-]|\.(?=[A-Za-z0-9_-]))*$/;
const URL_SAFE_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._~-]*$/u;
const UNSAFE_PATH_CHARACTERS = /[%?#\\\p{Cc}]/u;
const SHA_256_DIGEST_MESSAGE =
  'Expected a lowercase SHA-256 digest such as sha256:<64 hex>.';
const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'];

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toRecord(value: unknown): UnknownRecord | undefined {
  return isRecord(value) ? value : undefined;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

export function readRequiredString(input: {
  record: UnknownRecord | undefined;
  key: string;
  issues: ValidationIssues;
}): string | undefined {
  const value = input.record?.[input.key];

  if (isNonEmptyString(value)) return value;

  input.issues.add({
    path: input.key,
    message: `Expected ${input.key} to be a non-empty string.`,
  });

  return undefined;
}

export function readOptionalString(input: {
  record: UnknownRecord | undefined;
  key: string;
  issues: ValidationIssues;
}): string | undefined {
  if (input.record?.[input.key] === undefined) return undefined;

  return readRequiredString(input);
}

export function requireLiteral(input: {
  record: UnknownRecord | undefined;
  key: string;
  expected: string;
  issues: ValidationIssues;
}): boolean {
  if (input.record?.[input.key] === input.expected) return true;

  input.issues.add({
    path: input.key,
    message: `Expected ${input.key} to be "${input.expected}".`,
  });

  return false;
}

export function readRequiredOneOf<T extends string>(input: {
  record: UnknownRecord | undefined;
  key: string;
  allowed: readonly T[];
  issues: ValidationIssues;
}): T | undefined {
  const value = input.record?.[input.key];
  const member = input.allowed.find((candidate) => candidate === value);

  if (member !== undefined) return member;

  input.issues.add({
    path: input.key,
    message: `Expected ${input.key} to be ${formatAlternatives(input.allowed)}.`,
  });

  return undefined;
}

export function readOptionalOneOf<T extends string>(input: {
  record: UnknownRecord | undefined;
  key: string;
  allowed: readonly T[];
  issues: ValidationIssues;
}): T | undefined {
  if (input.record?.[input.key] === undefined) return undefined;

  return readRequiredOneOf(input);
}

export function readRequiredIdentifier(input: {
  record: UnknownRecord | undefined;
  key: string;
  label: string;
  issues: ValidationIssues;
}): string | undefined {
  const value = readRequiredString(input);

  if (value === undefined) return undefined;

  const valid = validateIdentifier({
    value,
    path: input.key,
    label: input.label,
    issues: input.issues,
  });

  return valid ? value : undefined;
}

export function validateIdentifier(input: {
  value: string;
  path: string;
  label: string;
  issues: ValidationIssues;
}): boolean {
  if (SAFE_IDENTIFIER.test(input.value)) return true;

  input.issues.add({
    path: input.path,
    message: `Expected ${input.label} to contain only letters, numbers, dots, dashes, and underscores, without traversal.`,
  });

  return false;
}

export function readRequiredUrlSafePathSegment(input: {
  record: UnknownRecord | undefined;
  key: string;
  label: string;
  issues: ValidationIssues;
}): string | undefined {
  const value = readRequiredString(input);

  if (value === undefined) return undefined;

  const valid = validateUrlSafePathSegment({
    value,
    path: input.key,
    label: input.label,
    issues: input.issues,
  });

  return valid ? value : undefined;
}

export function validateUrlSafePathSegment(input: {
  value: string;
  path: string;
  label: string;
  issues: ValidationIssues;
}): boolean {
  if (URL_SAFE_PATH_SEGMENT.test(input.value)) return true;

  input.issues.add({
    path: input.path,
    message: `Expected ${input.label} "${input.value}" to be a URL-safe path segment.`,
  });

  return false;
}

export function readRequiredSafeRelativePath(input: {
  record: UnknownRecord | undefined;
  key: string;
  issues: ValidationIssues;
}): string | undefined {
  const value = readRequiredString(input);

  if (value === undefined) return undefined;

  const valid = validateSafeRelativePath({
    value,
    path: input.key,
    issues: input.issues,
  });

  return valid ? value : undefined;
}

export function validateSafeRelativePath(input: {
  value: string;
  path: string;
  issues: ValidationIssues;
}): boolean {
  if (isSafeRelativePath(input.value)) return true;

  input.issues.add({
    path: input.path,
    message: `Expected "${input.value}" to be a safe relative path.`,
  });

  return false;
}

export function validateHttpUrl(input: {
  value: string;
  path: string;
  issues: ValidationIssues;
}): boolean {
  if (isHttpUrl(input.value)) return true;

  input.issues.add({
    path: input.path,
    message: 'Expected an absolute HTTP(S) URL.',
  });

  return false;
}

export function validateSemanticVersion(input: {
  value: string;
  path: string;
  issues: ValidationIssues;
}): void {
  if (SEMANTIC_VERSION.test(input.value)) return;

  input.issues.add({
    path: input.path,
    message: 'Expected a semantic version such as 1.2.3.',
  });
}

export function validateSemanticVersionRange(input: {
  value: string;
  path: string;
  issues: ValidationIssues;
}): void {
  if (SEMANTIC_VERSION_RANGE.test(input.value)) return;

  input.issues.add({
    path: input.path,
    message: 'Expected a semantic version range such as ^1.2.3.',
  });
}

export function validateOptionalSha256Integrity(input: {
  value: unknown;
  path: string;
  issues: ValidationIssues;
}): void {
  if (input.value === undefined) return;

  validateSha256Integrity(input);
}

export function validateSha256Integrity(input: {
  value: unknown;
  path: string;
  issues: ValidationIssues;
}): boolean {
  if (typeof input.value === 'string' && SHA_256_INTEGRITY.test(input.value))
    return true;
  input.issues.add({
    path: input.path,
    message: 'Expected SHA-256 integrity in SRI format.',
  });

  return false;
}

export function readSha256Digest(input: {
  value: unknown;
  path: string;
  issues: ValidationIssues;
}): string | undefined {
  if (typeof input.value === 'string' && SHA_256_DIGEST.test(input.value))
    return input.value;

  input.issues.add({
    path: input.path,
    message: SHA_256_DIGEST_MESSAGE,
  });

  return undefined;
}

export function validateSha256Digest(input: {
  value: unknown;
  path: string;
  issues: ValidationIssues;
}): boolean {
  if (typeof input.value === 'string' && SHA_256_DIGEST.test(input.value))
    return true;
  input.issues.add({
    path: input.path,
    message: SHA_256_DIGEST_MESSAGE,
  });

  return false;
}

export function validateMetadata(input: {
  value: unknown;
  path: string;
  issues: ValidationIssues;
}): void {
  if (input.value === undefined) return;

  const metadata = toRecord(input.value);

  if (!metadata) {
    input.issues.add({
      path: input.path,
      message: 'Expected metadata to be an object.',
    });

    return;
  }
  for (const [key, entry] of Object.entries(metadata)) {
    if (!isMetadataValue(entry))
      input.issues.add({
        path: `${input.path}.${key}`,
        message: 'Expected a string, number, or boolean metadata value.',
      });
  }
}

export function validateOptionalBoundedText(input: {
  value: unknown;
  path: string;
  maximumLength: number;
  issues: ValidationIssues;
}): void {
  if (input.value === undefined) return;

  if (
    isNonEmptyString(input.value) &&
    input.value.length <= input.maximumLength
  )
    return;
  input.issues.add({
    path: input.path,
    message: `Expected a non-empty string no longer than ${input.maximumLength} characters.`,
  });
}

export function validateIntegerAtLeast(input: {
  value: unknown;
  path: string;
  label: string;
  minimum: number;
  issues: ValidationIssues;
}): boolean {
  if (Number.isSafeInteger(input.value) && Number(input.value) >= input.minimum)
    return true;
  input.issues.add({
    path: input.path,
    message: `Expected ${input.label} to be an integer of at least ${input.minimum}.`,
  });

  return false;
}

export function validateUniqueValue(input: {
  value: string;
  path: string;
  label: string;
  seen: Set<string>;
  issues: ValidationIssues;
}): boolean {
  const duplicate = input.seen.has(input.value);
  input.seen.add(input.value);

  if (!duplicate) return true;

  input.issues.add({
    path: input.path,
    message: `Duplicate ${input.label} "${input.value}".`,
  });

  return false;
}

function isSafeRelativePath(value: string): boolean {
  return (
    value !== '' &&
    !value.startsWith('/') &&
    !UNSAFE_PATH_CHARACTERS.test(value) &&
    value
      .split('/')
      .every((segment) => segment && segment !== '.' && segment !== '..')
  );
}

export function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTNAMES.includes(hostname);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isMetadataValue(value: unknown): value is string | number | boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}
