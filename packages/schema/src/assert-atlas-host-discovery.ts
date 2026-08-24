import type {
  AtlasHostDiscovery,
  AtlasHostDiscoveryBinding,
} from './atlas-host-discovery.js';

const SAFE_IDENTIFIER = /^[A-Za-z0-9](?:[A-Za-z0-9_-]|\.(?=[A-Za-z0-9_-]))*$/u;
const SAFE_ENVIRONMENT = /^[A-Za-z0-9][A-Za-z0-9._~-]*$/u;

export function assertAtlasHostDiscovery(
  value: unknown,
): asserts value is AtlasHostDiscovery {
  if (!isRecord(value) || value.schemaVersion !== '1') {
    throw new Error('Atlas host discovery requires schemaVersion "1".');
  }
  if (!isSafeIdentifier(value.hostId)) {
    throw new Error('Atlas host discovery has an invalid hostId.');
  }
  if (!Array.isArray(value.bindings)) {
    throw new Error('Atlas host discovery bindings must be an array.');
  }

  const baseUrls = new Set<string>();
  for (const binding of value.bindings) {
    assertDiscoveryBinding(binding);
    const baseUrl = normalizeAtlasHostBaseUrl(binding.baseUrl);
    if (baseUrls.has(baseUrl)) {
      throw new Error(`Atlas host discovery repeats base URL "${baseUrl}".`);
    }
    baseUrls.add(baseUrl);
  }
  if (
    Object.keys(value).some(
      (field) => !['schemaVersion', 'hostId', 'bindings'].includes(field),
    )
  ) {
    throw new Error('Atlas host discovery has unsupported fields.');
  }
}

export function normalizeAtlasHostBaseUrl(value: string): string {
  const url = absoluteUrl(value, 'Atlas host base URL');
  assertPublicUrl(url, 'Atlas host base URL');
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      'Atlas host base URL must not contain credentials, a query, or a fragment.',
    );
  }

  const path = url.pathname.replace(/\/+$/u, '') || '/';
  return path === '/' ? url.origin : `${url.origin}${path}`;
}

export function assertAtlasManifestUrl(value: string): void {
  const url = absoluteUrl(value, 'Atlas discovery manifestUrl');
  assertPublicUrl(url, 'Atlas discovery manifestUrl');
  if (url.username || url.password || url.hash) {
    throw new Error(
      'Atlas discovery manifestUrl must not contain credentials or a fragment.',
    );
  }
}

function assertDiscoveryBinding(
  value: unknown,
): asserts value is AtlasHostDiscoveryBinding {
  if (!isRecord(value)) {
    throw new Error('Atlas host discovery binding must be an object.');
  }
  if (typeof value.baseUrl !== 'string') {
    throw new Error('Atlas host discovery binding requires baseUrl.');
  }
  normalizeAtlasHostBaseUrl(value.baseUrl);
  if (
    typeof value.environment !== 'string' ||
    value.environment === 'latest' ||
    !SAFE_ENVIRONMENT.test(value.environment)
  ) {
    throw new Error('Atlas host discovery binding has an invalid environment.');
  }
  if (typeof value.manifestUrl !== 'string') {
    throw new Error('Atlas host discovery binding requires manifestUrl.');
  }
  assertAtlasManifestUrl(value.manifestUrl);
  if (value.externalRegistries !== undefined) {
    assertExternalRegistries(value.externalRegistries);
  }
  if (
    Object.keys(value).some(
      (field) =>
        ![
          'baseUrl',
          'environment',
          'manifestUrl',
          'externalRegistries',
        ].includes(field),
    )
  ) {
    throw new Error('Atlas host discovery binding has unsupported fields.');
  }
}

function assertExternalRegistries(value: unknown): void {
  if (!Array.isArray(value)) {
    throw new Error('Atlas discovery externalRegistries must be an array.');
  }
  const identities = new Set<string>();
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry.registryUrl !== 'string' ||
      normalizeAtlasRegistryRoot(entry.registryUrl) !== entry.registryUrl ||
      typeof entry.environment !== 'string' ||
      entry.environment === 'latest' ||
      !SAFE_ENVIRONMENT.test(entry.environment)
    ) {
      throw new Error('Atlas discovery external registry is invalid.');
    }
    const identity = `${entry.registryUrl}|${entry.environment}`;
    if (identities.has(identity)) {
      throw new Error('Atlas discovery repeats an external registry.');
    }
    if (
      Object.keys(entry).some(
        (field) => !['registryUrl', 'environment'].includes(field),
      )
    ) {
      throw new Error(
        'Atlas discovery external registry has unsupported fields.',
      );
    }
    identities.add(identity);
  }
}

export function normalizeAtlasRegistryRoot(value: string): string {
  const url = absoluteUrl(value, 'Atlas registry URL');
  assertPublicUrl(url, 'Atlas registry URL');
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      'Atlas registry URL must not contain credentials, a query, or a fragment.',
    );
  }
  url.pathname = url.pathname.replace(/\/+$/u, '') || '/';
  return url.href.replace(/\/$/u, '');
}

function absoluteUrl(value: string, subject: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${subject} must be an absolute HTTP(S) URL.`);
  }
}

function assertPublicUrl(url: URL, subject: string): void {
  if (url.protocol === 'https:' || isLoopback(url)) return;
  throw new Error(`${subject} must use HTTPS outside loopback development.`);
}

function isLoopback(url: URL): boolean {
  return (
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  );
}

function isSafeIdentifier(value: unknown): value is string {
  return typeof value === 'string' && SAFE_IDENTIFIER.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
