import type { AtlasHostRuntimeConfig } from '@atlas/schema';
import { bootstrapError } from '../errors/bootstrap-error.js';
import { isLoopbackHostname } from '../loopback.js';

export const ATLAS_RUNTIME_CONFIG_PATH = '/atlas.runtime.json';

export function assertAtlasRuntimeConfig(
  value: unknown,
): asserts value is AtlasHostRuntimeConfig {
  assertRuntimeConfigFields(value);
  assertRegistryUrl({
    value: value.artifactRegistryUrl,
    field: 'artifactRegistryUrl',
  });
  if (value.environmentRegistryUrl !== undefined)
    assertRegistryUrl({
      value: value.environmentRegistryUrl,
      field: 'environmentRegistryUrl',
    });
}

export function resolveAtlasRuntimeConfig(
  value: unknown,
  hostUrl?: string,
): AtlasHostRuntimeConfig {
  assertRuntimeConfigFields(value);
  const runtimeConfigUrl = hostUrl
    ? new URL(ATLAS_RUNTIME_CONFIG_PATH, hostUrl)
    : undefined;

  return {
    ...value,
    artifactRegistryUrl: resolveRegistryUrl({
      value: value.artifactRegistryUrl,
      runtimeConfigUrl,
      field: 'artifactRegistryUrl',
    }),
    ...(value.environmentRegistryUrl === undefined
      ? {}
      : {
          environmentRegistryUrl: resolveRegistryUrl({
            value: value.environmentRegistryUrl,
            runtimeConfigUrl,
            field: 'environmentRegistryUrl',
          }),
        }),
  };
}

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

function assertRuntimeConfigFields(
  value: unknown,
): asserts value is AtlasHostRuntimeConfig {
  if (!isRecord(value))
    throw runtimeConfigError('Atlas runtime config must be a JSON object.');
  if (value.schemaVersion !== 'v1')
    throw runtimeConfigError(
      `Atlas runtime config requires schemaVersion "v1", got ${JSON.stringify(value.schemaVersion)}.`,
    );
  assertSegment({ value: value.hostId, field: 'hostId' });
  assertSegment({ value: value.environment, field: 'environment' });
  if (value.hostVersion !== undefined)
    assertSegment({ value: value.hostVersion, field: 'hostVersion' });
  assertKnownFields(value);
  if (value.environment === 'development') assertDevelopmentFields(value);
}

function assertKnownFields(value: Record<string, unknown>): void {
  const fields = new Set([
    ...BASE_FIELDS,
    ...(value.environment === 'development' ? DEVELOPMENT_FIELDS : []),
  ]);
  const unsupported = Object.keys(value).filter((field) => !fields.has(field));
  if (unsupported.length > 0)
    throw runtimeConfigError(
      `Atlas runtime config has unsupported fields for environment "${value.environment}": ${unsupported.join(', ')}.`,
    );
}

function assertDevelopmentFields(value: Record<string, unknown>): void {
  if (value.developmentSessionUrl !== undefined)
    assertDevelopmentSessionUrl(value.developmentSessionUrl);
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

function resolveRegistryUrl({
  value,
  runtimeConfigUrl,
  field,
}: {
  value: unknown;
  runtimeConfigUrl: URL | undefined;
  field: string;
}): string {
  if (typeof value !== 'string')
    throw runtimeConfigError(`Atlas runtime ${field} is required.`);
  if (isAbsoluteUrl(value)) {
    assertRegistryUrl({ value, field });

    return value;
  }
  if (!runtimeConfigUrl)
    throw runtimeConfigError(
      `Atlas runtime ${field} "${value}" is relative and requires a host URL to resolve against.`,
    );
  const url = new URL(value, runtimeConfigUrl);
  const resolved =
    url.pathname.endsWith('/') && !url.search && !url.hash
      ? url.href.slice(0, -1)
      : url.href;
  assertRegistryUrl({ value: resolved, field });

  return resolved;
}

function isAbsoluteUrl(value: string): boolean {
  try {
    new URL(value);

    return true;
  } catch {
    return false;
  }
}

export function environmentRegistryUrl(
  runtime: AtlasHostRuntimeConfig,
): string {
  return runtime.environmentRegistryUrl ?? runtime.artifactRegistryUrl;
}

export function environmentManifestUrl(
  runtime: AtlasHostRuntimeConfig,
): string {
  return new URL(
    `environments/${runtime.environment}/hosts/${runtime.hostId}/manifest.json`,
    `${environmentRegistryUrl(runtime)}/`,
  ).href;
}

export function artifactUrl(
  runtime: AtlasHostRuntimeConfig,
  path: string,
): string {
  return new URL(path, `${runtime.artifactRegistryUrl}/`).href;
}

function assertRegistryUrl({
  value,
  field,
}: {
  value: unknown;
  field: string;
}): void {
  if (typeof value !== 'string')
    throw runtimeConfigError(`Atlas runtime ${field} is required.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw runtimeConfigError(
      `Atlas runtime ${field} "${value}" must be an absolute URL.`,
    );
  }
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && isLoopbackHostname(url.hostname))
  )
    throw runtimeConfigError(
      `Atlas runtime ${field} "${value}" requires HTTPS outside local development.`,
    );
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    value.endsWith('/')
  )
    throw runtimeConfigError(
      `Atlas runtime ${field} "${value}" must be a normalized registry root without credentials, query, hash, or trailing slash.`,
    );
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
  if (
    value !== undefined &&
    (!Number.isInteger(value) || Number(value) < minimum)
  ) {
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
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._~-]*$/u.test(value)
  )
    throw runtimeConfigError(
      `Atlas runtime ${field} ${JSON.stringify(value)} must be a URL-safe path segment.`,
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function runtimeConfigError(message: string) {
  return bootstrapError({ code: 'RUNTIME_CONFIG_INVALID', message });
}
