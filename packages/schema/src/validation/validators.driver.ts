import { ValidationIssues } from './validation-issues.js';
import {
  readOptionalOneOf,
  readOptionalString,
  readRequiredIdentifier,
  readRequiredOneOf,
  readRequiredSafeRelativePath,
  readRequiredString,
  readRequiredUrlSafePathSegment,
  readSha256Digest,
  requireLiteral,
  validateHttpUrl,
  validateIntegerAtLeast,
  validateMetadata,
  validateOptionalBoundedText,
  validateOptionalSha256Integrity,
  validateSemanticVersion,
  validateSemanticVersionRange,
  validateSha256Digest,
  validateSha256Integrity,
  validateUniqueValue,
  type UnknownRecord,
} from './validators.js';

export class ValidatorsDriver {
  private readonly issues = ValidationIssues.create();
  private record: UnknownRecord | undefined;
  private result: unknown;

  given = {
    record: (record: UnknownRecord | undefined) => {
      this.record = record;

      return this;
    },
  };

  when = {
    requiredStringRead: (key: string) => {
      this.result = readRequiredString({
        record: this.record,
        key,
        issues: this.issues,
      });
    },
    optionalStringRead: (key: string) => {
      this.result = readOptionalString({
        record: this.record,
        key,
        issues: this.issues,
      });
    },
    literalRequired: (input: { key: string; expected: string }) => {
      this.result = requireLiteral({
        ...input,
        record: this.record,
        issues: this.issues,
      });
    },
    requiredOneOfRead: (input: { key: string; allowed: readonly string[] }) => {
      this.result = readRequiredOneOf({
        ...input,
        record: this.record,
        issues: this.issues,
      });
    },
    optionalOneOfRead: (input: { key: string; allowed: readonly string[] }) => {
      this.result = readOptionalOneOf({
        ...input,
        record: this.record,
        issues: this.issues,
      });
    },
    requiredIdentifierRead: (input: { key: string; label: string }) => {
      this.result = readRequiredIdentifier({
        ...input,
        record: this.record,
        issues: this.issues,
      });
    },
    requiredUrlSafePathSegmentRead: (input: { key: string; label: string }) => {
      this.result = readRequiredUrlSafePathSegment({
        ...input,
        record: this.record,
        issues: this.issues,
      });
    },
    requiredSafeRelativePathRead: (key: string) => {
      this.result = readRequiredSafeRelativePath({
        record: this.record,
        key,
        issues: this.issues,
      });
    },
    httpUrlValidated: (input: { value: string; path: string }) => {
      this.result = validateHttpUrl({ ...input, issues: this.issues });
    },
    semanticVersionValidated: (input: { value: string; path: string }) => {
      validateSemanticVersion({ ...input, issues: this.issues });
    },
    semanticVersionRangeValidated: (input: { value: string; path: string }) => {
      validateSemanticVersionRange({ ...input, issues: this.issues });
    },
    sha256IntegrityValidated: (input: { value: unknown; path: string }) => {
      this.result = validateSha256Integrity({ ...input, issues: this.issues });
    },
    optionalSha256IntegrityValidated: (input: {
      value: unknown;
      path: string;
    }) => {
      validateOptionalSha256Integrity({ ...input, issues: this.issues });
    },
    sha256DigestValidated: (input: { value: unknown; path: string }) => {
      this.result = validateSha256Digest({ ...input, issues: this.issues });
    },
    sha256DigestRead: (input: { value: unknown; path: string }) => {
      this.result = readSha256Digest({ ...input, issues: this.issues });
    },
    metadataValidated: (input: { value: unknown; path: string }) => {
      validateMetadata({ ...input, issues: this.issues });
    },
    optionalBoundedTextValidated: (input: {
      value: unknown;
      path: string;
      maximumLength: number;
    }) => {
      validateOptionalBoundedText({ ...input, issues: this.issues });
    },
    integerAtLeastValidated: (input: {
      value: unknown;
      path: string;
      label: string;
      minimum: number;
    }) => {
      this.result = validateIntegerAtLeast({ ...input, issues: this.issues });
    },
    uniqueValueValidated: (input: {
      value: string;
      path: string;
      label: string;
      seen: Set<string>;
    }) => {
      this.result = validateUniqueValue({ ...input, issues: this.issues });
    },
  };

  get = {
    issues: () => this.issues.toArray(),
    result: () => this.result,
  };
}
