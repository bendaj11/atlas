import type { AtlasHostRuntimeConfig } from '@atlas/schema';
import { isLoopbackHostname } from '../loopback.js';
import { runtimeConfigError } from './runtime-config-error.js';

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

const SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~-]*$/u;

export function assertRuntimeConfigFields(
  value: unknown,
): asserts value is AtlasHostRuntimeConfig {
  if (!isRecord(value)) {
    throw runtimeConfigError('Atlas runtime config must be a JSON object.');
  }

  if (value.schemaVersion !== 'v1') {
    throw runtimeConfigError(
      `Atlas runtime config requires schemaVersion "v1", got ${JSON.stringify(value.schemaVersion)}.`,
    );
  }

  assertSegment({ value: value.hostId, field: 'hostId' });
  assertSegment({ value: value.environment, field: 'environment' });
  if (value.hostVersion !== undefined) {
    assertSegment({ value: value.hostVersion, field: 'hostVersion' });
  }

  assertKnownFields(value);
  if (value.environment === 'development') assertDevelopmentFields(value);
}

function assertKnownFields(value: Record<string, unknown>): void {
  const fields = new Set([
    ...BASE_FIELDS,
    ...(value.environment === 'development' ? DEVELOPMENT_FIELDS : []),
  ]);
  const unsupported = Object.keys(value).filter((field) => !fields.has(field));

  if (unsupported.length > 0) {
    throw runtimeConfigError(
      `Atlas runtime config has unsupported fields for environment "${value.environment}": ${unsupported.join(', ')}.`,
    );
  }
}

function assertDevelopmentFields(value: Record<string, unknown>): void {
  if (value.developmentSessionUrl !== undefined) {
    assertDevelopmentSessionUrl(value.developmentSessionUrl);
  }

  assertOptionalInteger({
    value: value.resourcesRetryCount,
    field: 'resourcesRetryCount',
    minimum: 0,
  });
  assertOptionalInteger({
    value: value.resourcesTimeoutMs,
    field: 'resourcesTimeoutMs',
    minimum: 1,
  });
}

function assertDevelopmentSessionUrl(value: unknown): void {
  const message = `Atlas runtime developmentSessionUrl ${JSON.stringify(value)} must be an absolute http loopback URL.`;
  let url: URL;

  try {
    url = new URL(String(value));
  } catch {
    throw runtimeConfigError(message);
  }

  if (
    typeof value !== 'string' ||
    url.protocol !== 'http:' ||
    !isLoopbackHostname(url.hostname)
  ) {
    throw runtimeConfigError(message);
  }
}

function assertOptionalInteger({
  value,
  field,
  minimum,
}: {
  value: unknown;
  field: string;
  minimum: number;
}): void {
  if (value === undefined) return;

  if (!Number.isInteger(value) || Number(value) < minimum) {
    throw runtimeConfigError(
      `Atlas runtime ${field} ${JSON.stringify(value)} must be an integer of at least ${minimum}.`,
    );
  }
}

function assertSegment({
  value,
  field,
}: {
  value: unknown;
  field: string;
}): void {
  if (typeof value !== 'string' || !SEGMENT_PATTERN.test(value)) {
    throw runtimeConfigError(
      `Atlas runtime ${field} ${JSON.stringify(value)} must be a URL-safe path segment.`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
