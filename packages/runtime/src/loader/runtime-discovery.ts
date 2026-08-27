import {
  assertAtlasManifest,
  assertHostDeploymentManifest,
  errorSummary,
  hydratePublishedArtifactManifest,
  type AtlasHostCatalog,
  type AtlasHostDeploymentManifest,
  type AtlasHostRuntimeConfig,
  type AtlasManifest,
  type AtlasManifestDescriptor,
} from '@atlas/schema';
import { runResiliently, type AtlasRetryPolicy } from '../resilience.js';
import { mapWithConcurrency } from '../concurrency.js';
import { runtimeError } from '../runtime-error.js';
import { requestDevelopmentSession } from './development-session/development-session.js';

type FetchJson = (url: string, signal?: AbortSignal) => Promise<unknown>;
type FetchBytes = (url: string, signal?: AbortSignal) => Promise<ArrayBuffer>;
const defaultIntegrityChecks = new Map<string, Promise<void>>();
const MAX_CACHED_INTEGRITY_CHECKS = 256;

export interface AtlasRuntimeOverride {
  appId: string;
  manifest: AtlasManifest;
  reason: 'local' | 'pr' | 'historical';
}

export interface AtlasRuntimeOverrideDocument {
  schemaVersion: '1';
  hostId: string;
  overrides: AtlasRuntimeOverride[];
  generatedAt: string;
}

export interface AtlasBrowserOverrideOptions {
  hostId: string;
  /** @deprecated Development sessions are provided by the Columbus bridge. */
  search?: string;
  /** Tab-scoped storage. Its override document takes precedence over origin-wide storage. */
  sessionStorage?: Pick<Storage, 'getItem'> & Partial<Pick<Storage, 'setItem'>>;
  fetchJson?: FetchJson;
  developmentSession?: () => Promise<unknown | undefined>;
  requestPolicy?: AtlasRetryPolicy;
}

/** Host policy applied before Atlas downloads executable remote metadata. */
export interface AtlasRemoteTrustPolicy {
  allowedOrigins?: ReadonlySet<string>;
}

export const ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY = 'atlas.runtime-overrides';

export async function loadHostDeployment(options: {
  manifestUrl: string;
  expectedHostId?: string;
  expectedEnvironment?: string;
  fetchBytes?: FetchBytes;
  requestPolicy?: AtlasRetryPolicy;
}): Promise<AtlasHostCatalog> {
  const deploymentBytes = await runResiliently(
    (signal) =>
      options.fetchBytes
        ? options.fetchBytes(options.manifestUrl, signal)
        : defaultFetchBytes(options.manifestUrl, signal),
    { stage: 'manifest', resource: options.manifestUrl },
    options.requestPolicy,
  );
  const deployment = parseHostDeployment(deploymentBytes, options.manifestUrl);
  if (
    (options.expectedHostId && deployment.hostId !== options.expectedHostId) ||
    (options.expectedEnvironment &&
      deployment.environment !== options.expectedEnvironment)
  ) {
    throw runtimeConfigurationError(
      `Active host manifest selects host "${deployment.hostId}" in environment "${deployment.environment}", but runtime configuration selects host "${options.expectedHostId ?? deployment.hostId}" in environment "${options.expectedEnvironment ?? deployment.environment}".`,
    );
  }
  const references = [
    deployment.host,
    ...deployment.apps,
    ...(deployment.widgetProviders ?? []),
  ];
  const manifests = await mapWithConcurrency(
    references,
    (reference) =>
      loadPublishedManifest(
        reference as AtlasManifestDescriptor & { url: string },
        options.fetchBytes,
        options.requestPolicy,
      ),
    6,
  );
  const host = manifests[0];
  if (!host || host.kind !== 'host') {
    throw runtimeConfigurationError(
      'Active host manifest does not select a host artifact.',
    );
  }
  const appCount = deployment.apps.length;
  return {
    schemaVersion: '1',
    hostId: deployment.hostId,
    revision: deployment.deploymentRevision,
    generatedAt: '1970-01-01T00:00:00.000Z',
    host,
    apps: manifests.slice(1, 1 + appCount) as AtlasManifest[],
    ...(deployment.widgetProviders?.length
      ? { widgetProviders: manifests.slice(1 + appCount) as AtlasManifest[] }
      : {}),
  };
}

export async function loadPublishedManifest(
  reference: AtlasManifestDescriptor & { url: string },
  fetchBytes: FetchBytes = defaultFetchBytes,
  requestPolicy?: AtlasRetryPolicy,
): Promise<AtlasManifest | AtlasHostCatalog['host']> {
  const bytes = await runResiliently(
    (signal) => fetchBytes(reference.url, signal),
    { stage: 'manifest', resource: reference.url },
    requestPolicy,
  );
  await assertDescriptorBytes(reference, bytes);
  return parseArtifact(bytes, reference.url);
}

function parseHostDeployment(
  bytes: ArrayBuffer,
  url: string,
): AtlasHostDeploymentManifest {
  const value = parseJsonBytes(bytes, url);
  try {
    assertHostDeploymentManifest(value);
  } catch {
    throw runtimeConfigurationError(
      `Atlas host deployment manifest at "${url}" is invalid.`,
    );
  }
  return value;
}

function parseArtifact(
  bytes: ArrayBuffer,
  url: string,
): AtlasManifest | AtlasHostCatalog['host'] {
  const value = parseJsonBytes(bytes, url);
  try {
    return hydratePublishedArtifactManifest(value, url);
  } catch (error) {
    throw runtimeConfigurationError(
      `Atlas artifact manifest at "${url}" is invalid: ${errorSummary(error instanceof Error ? error.message : String(error))}`,
    );
  }
}

async function assertDescriptorBytes(
  descriptor: AtlasManifestDescriptor,
  bytes: ArrayBuffer,
): Promise<void> {
  if (bytes.byteLength !== descriptor.size) {
    throw runtimeConfigurationError(
      `Atlas manifest "${descriptor.path}" has an unexpected byte size.`,
    );
  }
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const actual = `sha256:${[...hash].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  if (actual !== descriptor.digest) {
    throw runtimeConfigurationError(
      `Atlas manifest "${descriptor.path}" failed SHA-256 verification.`,
    );
  }
}

function parseJsonBytes(bytes: ArrayBuffer, url: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw runtimeConfigurationError(
      `Atlas received invalid JSON from "${url}": ${errorSummary(error instanceof Error ? error.message : String(error))}`,
    );
  }
}

export async function loadBrowserRuntimeOverrides(
  options: AtlasBrowserOverrideOptions,
): Promise<AtlasRuntimeOverride[]> {
  const storage = globalThis.localStorage;
  const sessionStorage = options.sessionStorage ?? globalThis.sessionStorage;
  const developmentDocument = await (
    options.developmentSession ??
    (() => requestDevelopmentSession(options.hostId))
  )();
  const storedDocument = developmentDocument
    ? undefined
    : (sessionStorage?.getItem(ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY) ??
      storage?.getItem(ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY) ??
      undefined);
  const document = developmentDocument
    ? developmentDocument
    : storedDocument
      ? parseOverrideDocument(storedDocument)
      : undefined;
  if (!document) return [];
  validateOverrideShape(document);
  validateOverrideDocument(
    document,
    options.hostId,
    ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY,
  );
  if (developmentDocument) {
    sessionStorage?.setItem?.(
      ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY,
      JSON.stringify(document),
    );
  }
  return document.overrides;
}

export function resolveRuntimeManifests(
  catalog: AtlasHostCatalog,
  overrides: AtlasRuntimeOverride[] = [],
): AtlasManifest[] {
  return resolveRuntimeCatalog(catalog, overrides).apps;
}

export function resolveRuntimeCatalog(
  catalog: AtlasHostCatalog,
  overrides: AtlasRuntimeOverride[] = [],
): AtlasHostCatalog {
  const appsById = new Map<string, AtlasManifest>();
  for (const manifest of catalog.apps) {
    if (appsById.has(manifest.id))
      throw catalogSelectionError(
        `Atlas catalog selects multiple versions of app "${manifest.id}".`,
      );
    appsById.set(manifest.id, manifest);
  }
  const providersById = new Map<string, AtlasManifest>();
  for (const manifest of catalog.widgetProviders ?? []) {
    if (appsById.has(manifest.id) || providersById.has(manifest.id)) {
      throw catalogSelectionError(
        `Atlas catalog selects multiple versions of app "${manifest.id}".`,
      );
    }
    providersById.set(manifest.id, manifest);
  }
  const overriddenIds = new Set<string>();
  for (const override of overrides) {
    assertAtlasManifest(override.manifest);
    if (override.appId !== override.manifest.id) {
      throw overrideError(
        `Atlas override app id "${override.appId}" does not match its manifest id "${override.manifest.id}".`,
      );
    }
    if (overriddenIds.has(override.appId)) {
      throw overrideError(
        `Atlas overrides contain more than one entry for app "${override.appId}".`,
      );
    }
    const selected =
      appsById.get(override.appId) ?? providersById.get(override.appId);
    if (!selected) {
      throw overrideError(
        `Atlas override targets app "${override.appId}", but the host catalog does not select that app or widget provider.`,
      );
    }
    assertManifestSupportsHost(override.manifest, catalog.hostId, 'override');
    assertLocalManifestUrls(override.manifest);
    overriddenIds.add(override.appId);
    const resolved = {
      ...override.manifest,
      supportedHosts: selected.supportedHosts,
      placements: selected.placements,
    };
    if (appsById.has(override.appId)) appsById.set(override.appId, resolved);
    else providersById.set(override.appId, resolved);
  }
  const manifests = [...appsById.values(), ...providersById.values()];
  for (const manifest of manifests) {
    assertManifestSupportsHost(manifest, catalog.hostId, 'catalog');
    assertLocalManifestUrls(manifest);
  }
  return {
    ...catalog,
    apps: [...appsById.values()],
    ...(catalog.widgetProviders || providersById.size > 0
      ? { widgetProviders: [...providersById.values()] }
      : {}),
  };
}

export async function verifyManifestIntegrity(
  manifests: AtlasManifest[],
  fetchBytes: FetchBytes = defaultFetchBytes,
  policy: AtlasRemoteTrustPolicy = {},
): Promise<void> {
  for (const manifest of manifests) {
    assertManifestAssetTrust(manifest, policy);
    if (!manifest.integrity) continue;
    if (fetchBytes !== defaultFetchBytes) {
      await verifyRemoteEntryIntegrity(manifest, fetchBytes);
      continue;
    }
    const key = `${manifest.remoteEntryUrl}\0${manifest.integrity}`;
    let checking = defaultIntegrityChecks.get(key);
    if (!checking) {
      checking = verifyRemoteEntryIntegrity(manifest, fetchBytes).catch(
        (error) => {
          defaultIntegrityChecks.delete(key);
          throw error;
        },
      );
      defaultIntegrityChecks.set(key, checking);
      if (defaultIntegrityChecks.size > MAX_CACHED_INTEGRITY_CHECKS) {
        defaultIntegrityChecks.delete(
          defaultIntegrityChecks.keys().next().value!,
        );
      }
    }
    await checking;
  }
}

async function verifyRemoteEntryIntegrity(
  manifest: AtlasManifest,
  fetchBytes: FetchBytes,
): Promise<void> {
  const [algorithm, expected] = manifest.integrity!.split('-', 2);
  if (algorithm !== 'sha256' || !expected) {
    throw trustError(
      `Atlas app "${manifest.id}" has an unsupported integrity value; Atlas requires sha256-<base64>.`,
    );
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    await fetchBytes(manifest.remoteEntryUrl),
  );
  if (bytesToBase64(new Uint8Array(digest)) !== expected) {
    throw trustError(
      `Atlas rejected app "${manifest.id}" because its remote entry bytes do not match the manifest SHA-256 integrity value.`,
    );
  }
}

/** Verifies manifests independently so one rejected remote cannot prevent the host from starting. */
export async function findManifestTrustErrors(
  manifests: AtlasManifest[],
  policy: AtlasRemoteTrustPolicy,
  fetchBytes: FetchBytes = defaultFetchBytes,
  requestPolicy?: AtlasRetryPolicy,
): Promise<ReadonlyMap<string, Error>> {
  const errors = new Map<string, Error>();
  await mapWithConcurrency(manifests, async (manifest) => {
    try {
      await verifyManifestIntegrity(
        [manifest],
        (url) =>
          runResiliently(
            (signal) => fetchBytes(url, signal),
            {
              stage: 'integrity',
              resource: url,
              appId: manifest.id,
              version: manifest.version,
            },
            requestPolicy,
          ),
        policy,
      );
    } catch (error) {
      errors.set(manifest.id, toError(error));
    }
  });
  return errors;
}

/** Builds the default fail-closed policy from deployment configuration. */
export function createRemoteTrustPolicy(
  config: AtlasHostRuntimeConfig,
): AtlasRemoteTrustPolicy {
  const baseUrl = globalThis.location?.href ?? 'http://atlas.local';
  const origins = [
    config.artifactRegistryUrl,
    config.environmentRegistryUrl ?? config.artifactRegistryUrl,
  ].map((value) => new URL(value, baseUrl).origin);
  return { allowedOrigins: new Set(origins) };
}

function parseOverrideDocument(value: string): AtlasRuntimeOverrideDocument {
  try {
    const document: unknown = JSON.parse(value);
    validateOverrideShape(document);
    return document;
  } catch {
    throw overrideError(
      `Atlas runtime override data in ${ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY} is not valid JSON or has an invalid shape.`,
    );
  }
}

function validateOverrideShape(
  value: unknown,
): asserts value is AtlasRuntimeOverrideDocument {
  if (
    !isRecord(value) ||
    value.schemaVersion !== '1' ||
    typeof value.hostId !== 'string' ||
    typeof value.generatedAt !== 'string' ||
    !Array.isArray(value.overrides)
  ) {
    throw overrideError(
      `Atlas runtime override data in ${ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY} has an invalid document shape.`,
    );
  }
  for (const override of value.overrides) {
    if (
      !isRecord(override) ||
      typeof override.appId !== 'string' ||
      !isRecord(override.manifest) ||
      typeof override.reason !== 'string'
    ) {
      throw overrideError(
        `Atlas runtime override data in ${ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY} contains an invalid app entry.`,
      );
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validateOverrideDocument(
  document: AtlasRuntimeOverrideDocument,
  hostId: string,
  source: string,
): void {
  if (document.schemaVersion !== '1' || !Array.isArray(document.overrides)) {
    throw overrideError(
      `Atlas runtime override document from ${source} has an unsupported schema or missing overrides array.`,
    );
  }
  if (document.hostId !== hostId) {
    throw overrideError(
      `Atlas override targets host "${document.hostId}", but the current host is "${hostId}".`,
    );
  }
  for (const override of document.overrides) {
    if (override.appId !== override.manifest.id) {
      throw overrideError(
        `Atlas override app id "${override.appId}" does not match its manifest id "${override.manifest.id}".`,
      );
    }
    try {
      assertAtlasManifest(override.manifest);
    } catch (error) {
      const detail = errorSummary(
        error instanceof Error ? error.message : String(error),
      );
      throw overrideError(
        `Atlas override for app "${override.appId}" is invalid: ${detail}`,
        error,
      );
    }
  }
}

async function defaultFetchBytes(
  url: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const response = await fetch(url, fetchRequestOptions(url, signal));
  if (!response.ok) {
    throw networkError(
      `Atlas could not download asset "${url}": HTTP ${response.status} ${response.statusText}.`,
    );
  }
  return response.arrayBuffer();
}

function fetchRequestOptions(
  url: string,
  signal?: AbortSignal,
): RequestInit & { targetAddressSpace?: 'loopback' } {
  const target = new URL(
    url,
    globalThis.location?.href ?? 'http://atlas.local',
  );
  return {
    ...(signal ? { signal } : {}),
    ...(isLoopbackHostname(target.hostname)
      ? { targetAddressSpace: 'loopback' as const }
      : {}),
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function assertManifestAssetTrust(
  manifest: AtlasManifest,
  policy: AtlasRemoteTrustPolicy = {},
): void {
  if (manifest.channel === 'local') {
    assertLocalManifestUrls(manifest);
    return;
  }
  assertTrustedAssetUrl(manifest.remoteEntryUrl, manifest.id, 'remote', policy);
  assertManifestStylesTrust(manifest, policy);
}

export function assertManifestStylesTrust(
  manifest: AtlasManifest,
  policy: AtlasRemoteTrustPolicy = {},
): void {
  if (manifest.channel === 'local') {
    assertLocalManifestUrls(manifest);
    return;
  }
  for (const stylesheet of manifest.styles ?? []) {
    assertTrustedAssetUrl(stylesheet.href, manifest.id, 'stylesheet', policy);
  }
}

function assertTrustedAssetUrl(
  urlValue: string,
  appId: string,
  kind: string,
  policy: AtlasRemoteTrustPolicy,
): void {
  const url = new URL(
    urlValue,
    globalThis.location?.href ?? 'http://atlas.local',
  );
  if (!isHttpProtocol(url.protocol)) {
    throw trustError(
      `Atlas app "${appId}" uses unsupported ${kind} protocol "${url.protocol}".`,
    );
  }
  if (policy.allowedOrigins && !policy.allowedOrigins.has(url.origin)) {
    throw trustError(
      `Atlas app "${appId}" uses ${kind} origin "${url.origin}", which is not allowed by the host runtime configuration.`,
    );
  }
}

function assertManifestSupportsHost(
  manifest: AtlasManifest,
  hostId: string,
  source: string,
): void {
  if (
    !manifest.supportedHosts.includes('*') &&
    !manifest.supportedHosts.includes(hostId)
  ) {
    throw catalogSelectionError(
      `Atlas ${source} manifest for app "${manifest.id}" does not support host "${hostId}".`,
    );
  }
}

function assertLocalManifestUrls(manifest: AtlasManifest): void {
  if (manifest.channel !== 'local') return;
  const urls = [
    manifest.remoteEntryUrl,
    ...(manifest.styles ?? []).map(({ href }) => href),
    ...(manifest.exportedWidgets ?? []).map(
      ({ remoteEntryUrl }) => remoteEntryUrl,
    ),
  ];
  for (const value of urls) {
    const url = new URL(
      value,
      globalThis.location?.href ?? 'http://atlas.local',
    );
    if (!isHttpProtocol(url.protocol) || !isLoopbackHostname(url.hostname)) {
      throw trustError(
        `Atlas local app "${manifest.id}" uses non-loopback asset URL "${url.href}".`,
      );
    }
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
}

function isHttpProtocol(protocol: string): boolean {
  return protocol === 'http:' || protocol === 'https:';
}

function runtimeConfigurationError(summary: string): Error {
  return runtimeError(summary, {
    suggestedActions:
      'Correct the named host runtime configuration, redeploy it, then reload the page.',
    code: 'ATLAS_INVALID_RUNTIME_CONFIG',
  });
}

function catalogSelectionError(summary: string): Error {
  return runtimeError(summary, {
    suggestedActions:
      'Correct the host catalog so it selects one compatible version per app, republish it, then reload the page.',
    code: 'ATLAS_INVALID_CATALOG_SELECTION',
  });
}

function overrideError(summary: string, cause?: unknown): Error {
  return runtimeError(summary, {
    suggestedActions:
      'Open Columbus, correct or disable the affected override, then reload the host page.',
    ...(cause !== undefined ? { cause } : {}),
    code: 'ATLAS_INVALID_OVERRIDE',
  });
}

function trustError(summary: string): Error {
  return runtimeError(summary, {
    suggestedActions:
      'Correct the app manifest URL, allowed origin, or integrity value; rebuild and republish the app, then reload.',
    code: 'ATLAS_REMOTE_TRUST_REJECTED',
  });
}

function networkError(summary: string): Error {
  return runtimeError(summary, {
    suggestedActions:
      'Verify the URL is deployed, reachable, and permits the host origin through CORS, then retry.',
    code: 'ATLAS_RESOURCE_HTTP_ERROR',
  });
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
