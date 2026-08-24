import type { AtlasHostRuntimeConfig } from '@atlas/schema';

export interface AtlasBootstrapManifest {
  schemaVersion: '2';
  hostId: string;
  registryUrl: string;
  resourcesTimeoutMs: number;
  resourcesRetryCount: number;
  assetOrigins?: readonly string[];
  developmentRuntime?: AtlasHostRuntimeConfig;
  digest?: string;
  files?: readonly string[];
}

export function assertAtlasBootstrapManifest(
  value: unknown,
): asserts value is AtlasBootstrapManifest {
  if (!isRecord(value) || value.schemaVersion !== '2') {
    throw new Error('Atlas bootstrap metadata is invalid.');
  }
  requiredString(value.hostId, 'hostId');
  assertRegistryUrl(value.registryUrl);
  positiveInteger(value.resourcesTimeoutMs, 'resourcesTimeoutMs');
  nonNegativeInteger(value.resourcesRetryCount, 'resourcesRetryCount');
  if (value.assetOrigins !== undefined) {
    if (!Array.isArray(value.assetOrigins)) {
      throw new Error('Atlas bootstrap assetOrigins must be an array.');
    }
    const origins = new Set<string>();
    for (const origin of value.assetOrigins) {
      assertAssetOrigin(origin);
      if (origins.has(origin)) {
        throw new Error('Atlas bootstrap assetOrigins must be unique.');
      }
      origins.add(origin);
    }
  }
  if (value.developmentRuntime !== undefined) {
    assertDevelopmentRuntime(value.developmentRuntime, value.hostId);
  }
  if (
    value.digest !== undefined &&
    (typeof value.digest !== 'string' ||
      !/^sha256:[0-9a-f]{64}$/u.test(value.digest))
  ) {
    throw new Error('Atlas bootstrap digest must be a SHA-256 digest.');
  }
  if (value.files !== undefined) assertBootstrapFiles(value.files);
  const supportedFields = new Set([
    'schemaVersion',
    'hostId',
    'registryUrl',
    'resourcesTimeoutMs',
    'resourcesRetryCount',
    'assetOrigins',
    'developmentRuntime',
    'digest',
    'files',
  ]);
  if (Object.keys(value).some((field) => !supportedFields.has(field))) {
    throw new Error('Atlas bootstrap metadata has unsupported fields.');
  }
}

export function normalizeAtlasRegistryUrl(value: string): string {
  const url = absoluteUrl(value, 'registryUrl');
  assertSecureHttpUrl(url, 'registryUrl');
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      'Atlas bootstrap registryUrl cannot contain credentials, a query, or a fragment.',
    );
  }
  url.pathname = url.pathname.replace(/\/+$/u, '') || '/';
  return url.href.replace(/\/$/u, '');
}

function assertRegistryUrl(value: unknown): void {
  if (typeof value !== 'string' || normalizeAtlasRegistryUrl(value) !== value) {
    throw new Error('Atlas bootstrap registryUrl must be a normalized URL.');
  }
}

function assertAssetOrigin(value: unknown): void {
  if (typeof value !== 'string') {
    throw new Error('Atlas bootstrap assetOrigins must contain URLs.');
  }
  const url = absoluteUrl(value, 'assetOrigins');
  assertSecureHttpUrl(url, 'assetOrigins');
  if (url.origin !== value) {
    throw new Error('Atlas bootstrap assetOrigins must contain URL origins.');
  }
}

function assertDevelopmentRuntime(value: unknown, hostId: string): void {
  if (
    !isRecord(value) ||
    value.schemaVersion !== '1' ||
    value.hostId !== hostId ||
    typeof value.developmentSessionUrl !== 'string' ||
    typeof value.environment !== 'string' ||
    !value.environment.trim() ||
    typeof value.manifestUrl !== 'string'
  ) {
    throw new Error('Atlas development runtime metadata is invalid.');
  }
}

function assertBootstrapFiles(value: unknown): void {
  if (!Array.isArray(value)) {
    throw new Error('Atlas bootstrap files must be an array.');
  }
  const files = new Set<string>();
  for (const file of value) {
    if (
      typeof file !== 'string' ||
      !file ||
      file === '.' ||
      file === '..' ||
      file.includes('/') ||
      file.includes('\\')
    ) {
      throw new Error('Atlas bootstrap files must contain root file names.');
    }
    if (files.has(file)) {
      throw new Error('Atlas bootstrap files must be unique.');
    }
    files.add(file);
  }
}

function assertSecureHttpUrl(url: URL, field: string): void {
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error(
      `Atlas bootstrap ${field} requires HTTPS outside local development.`,
    );
  }
}

function absoluteUrl(value: string, field: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`Atlas bootstrap ${field} must be an absolute URL.`);
  }
}

function requiredString(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Atlas bootstrap ${field} is required.`);
  }
}

function positiveInteger(value: unknown, field: string): void {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new Error(`Atlas bootstrap ${field} must be a positive integer.`);
  }
}

function nonNegativeInteger(value: unknown, field: string): void {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`Atlas bootstrap ${field} must be a non-negative integer.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
