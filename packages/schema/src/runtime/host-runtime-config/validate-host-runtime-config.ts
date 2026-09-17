import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import { assertValid } from '../../validation/assert-valid.js';
import { ValidationIssues } from '../../validation/validation-issues.js';
import {
  asRecord,
  isLoopbackHostname,
  requiredLiteral,
  requiredUrlSafePathSegment,
  validateInteger,
  type UnknownRecord,
} from '../../validation/validators.js';
import type { AtlasHostRuntimeConfig } from '../atlas-host-runtime-config.js';
import { validateRegistryRootUrl } from './registry-root-url.js';

export const ATLAS_RUNTIME_CONFIG_SCHEMA_VERSION = 'v1';
export const ATLAS_DEVELOPMENT_ENVIRONMENT = 'development';

const BASE_FIELDS = [
  'schemaVersion',
  'hostId',
  'hostVersion',
  'environment',
  'artifactRegistryUrl',
  'environmentRegistryUrl',
];

const DEVELOPMENT_FIELDS = [
  'developmentSessionUrl',
  'resourcesTimeoutMs',
  'resourcesRetryCount',
];

/** Checks unknown JSON and returns all host runtime config problems. */
export function validateHostRuntimeConfig(
  value: unknown,
): AtlasValidationIssue[] {
  const issues = ValidationIssues.create();
  const record = collectRuntimeConfigFieldIssues({ value, issues });
  if (record) collectRegistryRootIssues({ record, issues });

  return issues.list();
}

/** Checks unknown JSON and throws unless it is a valid host runtime config with absolute registries. */
export function assertAtlasRuntimeConfig(
  value: unknown,
): asserts value is AtlasHostRuntimeConfig {
  const issues = ValidationIssues.create();
  const record = collectRuntimeConfigFieldIssues({ value, issues });
  if (record) collectRegistryRootIssues({ record, issues });
  assertValid({ issues, message: 'Invalid Atlas runtime config.' });
}

export function collectRuntimeConfigFieldIssues(input: {
  value: unknown;
  issues: ValidationIssues;
}): UnknownRecord | undefined {
  const { issues } = input;
  const record = asRecord(input.value);

  if (!record) {
    issues.add({
      path: '',
      message: 'Expected the runtime config to be an object.',
    });

    return undefined;
  }

  requiredLiteral({
    record,
    key: 'schemaVersion',
    expected: ATLAS_RUNTIME_CONFIG_SCHEMA_VERSION,
    issues,
  });
  requiredUrlSafePathSegment({
    record,
    key: 'hostId',
    label: 'hostId',
    issues,
  });
  requiredUrlSafePathSegment({
    record,
    key: 'environment',
    label: 'environment',
    issues,
  });
  if (record.hostVersion !== undefined) {
    requiredUrlSafePathSegment({
      record,
      key: 'hostVersion',
      label: 'hostVersion',
      issues,
    });
  }

  collectUnknownFieldIssues({ record, issues });
  if (record.environment === ATLAS_DEVELOPMENT_ENVIRONMENT) {
    collectDevelopmentFieldIssues({ record, issues });
  }

  return record;
}

function collectRegistryRootIssues(input: {
  record: UnknownRecord;
  issues: ValidationIssues;
}): void {
  const { record, issues } = input;

  validateRegistryRootUrl({
    value: record.artifactRegistryUrl,
    path: 'artifactRegistryUrl',
    issues,
  });
  if (record.environmentRegistryUrl !== undefined) {
    validateRegistryRootUrl({
      value: record.environmentRegistryUrl,
      path: 'environmentRegistryUrl',
      issues,
    });
  }
}

function collectUnknownFieldIssues(input: {
  record: UnknownRecord;
  issues: ValidationIssues;
}): void {
  const { record, issues } = input;
  const development = record.environment === ATLAS_DEVELOPMENT_ENVIRONMENT;
  const known = new Set([
    ...BASE_FIELDS,
    ...(development ? DEVELOPMENT_FIELDS : []),
  ]);

  for (const field of Object.keys(record)) {
    if (known.has(field)) continue;

    issues.add({
      path: field,
      message: `Unexpected field ${field} for environment "${String(record.environment)}".`,
    });
  }
}

function collectDevelopmentFieldIssues(input: {
  record: UnknownRecord;
  issues: ValidationIssues;
}): void {
  const { record, issues } = input;

  if (record.developmentSessionUrl !== undefined) {
    validateDevelopmentSessionUrl({
      value: record.developmentSessionUrl,
      issues,
    });
  }

  if (record.resourcesRetryCount !== undefined) {
    validateInteger({
      value: record.resourcesRetryCount,
      path: 'resourcesRetryCount',
      label: 'resourcesRetryCount',
      minimum: 0,
      issues,
    });
  }

  if (record.resourcesTimeoutMs !== undefined) {
    validateInteger({
      value: record.resourcesTimeoutMs,
      path: 'resourcesTimeoutMs',
      label: 'resourcesTimeoutMs',
      minimum: 1,
      issues,
    });
  }
}

function validateDevelopmentSessionUrl(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  const { value, issues } = input;
  const message = `Expected developmentSessionUrl ${JSON.stringify(value)} to be an absolute http loopback URL.`;

  let url: URL;
  try {
    url = new URL(String(value));
  } catch {
    issues.add({ path: 'developmentSessionUrl', message });

    return;
  }

  if (
    typeof value !== 'string' ||
    url.protocol !== 'http:' ||
    !isLoopbackHostname(url.hostname)
  ) {
    issues.add({ path: 'developmentSessionUrl', message });
  }
}
