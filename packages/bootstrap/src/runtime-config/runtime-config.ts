import type { AtlasHostRuntimeConfig } from '@atlas/schema';

export const ATLAS_RUNTIME_CONFIG_PATH = '/atlas.runtime.json';

export function assertAtlasRuntimeConfig(value: unknown): asserts value is AtlasHostRuntimeConfig {
  if (!isRecord(value) || value.schemaVersion !== 'v1') throw new Error('Atlas runtime config requires schemaVersion "v1".');
  assertSegment(value.hostId, 'hostId');
  assertSegment(value.environment, 'environment');
  assertRegistryUrl(value.artifactRegistryUrl, 'artifactRegistryUrl');
  if (value.environmentRegistryUrl !== undefined) assertRegistryUrl(value.environmentRegistryUrl, 'environmentRegistryUrl');
  const fields = new Set(['schemaVersion', 'hostId', 'environment', 'artifactRegistryUrl', 'environmentRegistryUrl']);
  if (Object.keys(value).some((field) => !fields.has(field))) throw new Error('Atlas runtime config has unsupported fields.');
}

export function environmentRegistryUrl(runtime: AtlasHostRuntimeConfig): string {
  return runtime.environmentRegistryUrl ?? runtime.artifactRegistryUrl;
}

export function environmentManifestUrl(runtime: AtlasHostRuntimeConfig): string {
  return new URL(`environments/${runtime.environment}/hosts/${runtime.hostId}/manifest.json`, `${environmentRegistryUrl(runtime)}/`).href;
}

export function artifactUrl(runtime: AtlasHostRuntimeConfig, path: string): string {
  return new URL(path, `${runtime.artifactRegistryUrl}/`).href;
}

function assertRegistryUrl(value: unknown, field: string): void {
  if (typeof value !== 'string') throw new Error(`Atlas runtime ${field} is required.`);
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`Atlas runtime ${field} must be an absolute URL.`); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error(`Atlas runtime ${field} requires HTTPS outside local development.`);
  if (url.username || url.password || url.search || url.hash || value.endsWith('/')) throw new Error(`Atlas runtime ${field} must be a normalized registry root.`);
}

function assertSegment(value: unknown, field: string): void {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._~-]*$/u.test(value)) throw new Error(`Atlas runtime ${field} must be a URL-safe path segment.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
