import {
  assertAtlasHostCatalog,
  assertAtlasManifest,
  actionableMessage,
  type AtlasHostCatalog,
  type AtlasHostRuntimeConfig,
  type AtlasManifest
} from "@atlas/schema";
import { runResiliently, type AtlasRetryPolicy } from "../resilience.js";
import { mapWithConcurrency } from "../concurrency.js";

type FetchJson = (url: string, signal?: AbortSignal) => Promise<unknown>;
type FetchBytes = (url: string, signal?: AbortSignal) => Promise<ArrayBuffer>;

export interface AtlasRuntimeOverride {
  appId: string;
  manifest: AtlasManifest;
  reason: "local" | "pr" | "historical";
}

export interface AtlasRuntimeOverrideDocument {
  schemaVersion: "1";
  hostId: string;
  overrides: AtlasRuntimeOverride[];
  generatedAt: string;
}

export interface AtlasBrowserOverrideOptions {
  hostId: string;
  /** @deprecated Compatibility alias for allowCustomOverrides. */
  enabled?: boolean;
  /** Allows localhost/custom-URL overrides. Registry-backed PR and historical overrides need no opt-in. */
  allowCustomOverrides?: boolean;
  search?: string;
  storage?: Pick<Storage, "getItem">;
  /** Tab-scoped storage. Its override document takes precedence over origin-wide storage. */
  sessionStorage?: Pick<Storage, "getItem">;
  fetchJson?: FetchJson;
  requestPolicy?: AtlasRetryPolicy;
}

/** Host policy applied before Atlas downloads executable remote metadata. */
export interface AtlasRemoteTrustPolicy {
  allowedOrigins?: ReadonlySet<string>;
}

export const ATLAS_OVERRIDE_QUERY_PARAM = "atlas-override";
export const ATLAS_OVERRIDE_STORAGE_KEY = "atlas.runtime-override-url";
export const ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY = "atlas.runtime-overrides";

export async function loadHostCatalog(options: {
  catalogUrl: string;
  fetchJson?: FetchJson;
  requestPolicy?: AtlasRetryPolicy;
}): Promise<AtlasHostCatalog> {
  const catalog = await runResiliently(
    (signal) => options.fetchJson
      ? options.fetchJson(options.catalogUrl, signal)
      : defaultFetchJson(options.catalogUrl, signal),
    { stage: "catalog", resource: options.catalogUrl },
    options.requestPolicy
  );
  assertAtlasHostCatalog(catalog);
  return catalog;
}

export async function loadHostRuntimeConfig(
  url = "/atlas.runtime.json",
  fetchJson: FetchJson = defaultFetchJson,
  requestPolicy?: AtlasRetryPolicy
): Promise<AtlasHostRuntimeConfig> {
  const config = await runResiliently(
    (signal) => fetchJson(url, signal),
    { stage: "runtime-config", resource: url },
    requestPolicy
  );
  if (!isHostRuntimeConfig(config)) {
    throw new Error(`Invalid Atlas host runtime configuration from ${url}.`);
  }
  validateRequestPolicy(config);
  if (config.allowOverrides !== undefined && typeof config.allowOverrides !== "boolean") {
    throw new Error("Atlas host allowOverrides must be a boolean.");
  }
  if (config.allowCustomOverrides !== undefined && typeof config.allowCustomOverrides !== "boolean") {
    throw new Error("Atlas host allowCustomOverrides must be a boolean.");
  }
  validateRuntimeUrls(config.externalRegistryUrls, "externalRegistryUrls");
  validateRuntimeUrls(config.assetOrigins, "assetOrigins");
  return config;
}

function validateRuntimeUrls(values: string[] | undefined, field: string): void {
  if (values === undefined) return;
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || !isHttpUrl(value))) {
    throw new Error(`Atlas host ${field} must be an array of absolute HTTP(S) URLs.`);
  }
}

function isHttpUrl(value: string): boolean {
  try { return isHttpProtocol(new URL(value).protocol); }
  catch { return false; }
}

function validateRequestPolicy(config: AtlasHostRuntimeConfig): void {
  if (config.resourcesTimeoutMs !== undefined && (!Number.isInteger(config.resourcesTimeoutMs) || config.resourcesTimeoutMs < 1)) {
    throw new Error("Atlas host resourcesTimeoutMs must be a positive integer.");
  }
  if (config.resourcesRetryCount !== undefined && (!Number.isInteger(config.resourcesRetryCount) || config.resourcesRetryCount < 0)) {
    throw new Error("Atlas host resourcesRetryCount must be a non-negative integer.");
  }
}

export async function loadBrowserRuntimeOverrides(options: AtlasBrowserOverrideOptions): Promise<AtlasRuntimeOverride[]> {
  const search = options.search ?? globalThis.location?.search ?? "";
  const queryUrl = new URLSearchParams(search).get(ATLAS_OVERRIDE_QUERY_PARAM);
  const storage = options.storage ?? globalThis.localStorage;
  const sessionStorage = options.sessionStorage ?? globalThis.sessionStorage;
  const storedUrl = storage?.getItem(ATLAS_OVERRIDE_STORAGE_KEY) ?? undefined;
  const allowCustomOverrides = options.allowCustomOverrides ?? options.enabled ?? false;
  const url = allowCustomOverrides ? queryUrl ?? storedUrl : undefined;
  const storedDocument = sessionStorage?.getItem(ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY)
    ?? storage?.getItem(ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY)
    ?? undefined;
  if (!url && !storedDocument) return [];

  const document = url
    ? await runResiliently(
      (signal) => (options.fetchJson ?? defaultFetchJson)(url, signal),
      { stage: "runtime-overrides", resource: url },
      options.requestPolicy
    )
    : parseOverrideDocument(storedDocument!);
  validateOverrideShape(document);
  validateOverrideDocument(document, options.hostId, url ?? ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY);
  return document.overrides.filter((override) => allowCustomOverrides
    || (override.reason !== "local" && override.manifest.channel !== "local"));
}

export function resolveRuntimeManifests(catalog: AtlasHostCatalog, overrides: AtlasRuntimeOverride[] = []): AtlasManifest[] {
  const byId = new Map<string, AtlasManifest>();
  for (const manifest of catalog.apps) {
    if (byId.has(manifest.id)) throw new Error(`Atlas catalog contains multiple selected versions for app "${manifest.id}".`);
    byId.set(manifest.id, manifest);
  }
  const overriddenIds = new Set<string>();
  for (const override of overrides) {
    assertAtlasManifest(override.manifest);
    if (override.appId !== override.manifest.id) {
      throw new Error(`Atlas override app id "${override.appId}" does not match manifest id "${override.manifest.id}".`);
    }
    if (overriddenIds.has(override.appId)) {
      throw new Error(`Atlas overrides contain duplicate entries for app "${override.appId}".`);
    }
    if (!byId.has(override.appId)) {
      throw new Error(`Atlas override targets app "${override.appId}", which is not selected by the host catalog.`);
    }
    assertManifestSupportsHost(override.manifest, catalog.hostId, "override");
    assertLocalManifestUrls(override.manifest);
    const selected = byId.get(override.appId)!;
    overriddenIds.add(override.appId);
    byId.set(override.appId, {
      ...override.manifest,
      supportedHosts: selected.supportedHosts,
      placements: selected.placements
    });
  }
  const manifests = [...byId.values()];
  for (const manifest of manifests) {
    assertManifestSupportsHost(manifest, catalog.hostId, "catalog");
    assertLocalManifestUrls(manifest);
  }
  return manifests;
}

export async function verifyManifestIntegrity(
  manifests: AtlasManifest[],
  fetchBytes: FetchBytes = defaultFetchBytes,
  policy: AtlasRemoteTrustPolicy = {}
): Promise<void> {
  for (const manifest of manifests) {
    assertManifestAssetTrust(manifest, policy);
    if (!manifest.integrity) {
      continue;
    }
    const [algorithm, expected] = manifest.integrity.split("-", 2);
    if (algorithm !== "sha256" || !expected) throw new Error(`Atlas app "${manifest.id}" has an unsupported integrity value.`);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", await fetchBytes(manifest.remoteEntryUrl));
    if (bytesToBase64(new Uint8Array(digest)) !== expected) {
      throw new Error(`Atlas app "${manifest.id}" failed remote entry integrity verification.`);
    }
  }
}

/** Verifies manifests independently so one rejected remote cannot prevent the host from starting. */
export async function findManifestTrustErrors(
  manifests: AtlasManifest[],
  policy: AtlasRemoteTrustPolicy,
  fetchBytes: FetchBytes = defaultFetchBytes,
  requestPolicy?: AtlasRetryPolicy
): Promise<ReadonlyMap<string, Error>> {
  const errors = new Map<string, Error>();
  await mapWithConcurrency(manifests, async (manifest) => {
    try {
      await verifyManifestIntegrity([manifest], (url) => runResiliently(
        (signal) => fetchBytes(url, signal),
        { stage: "integrity", resource: url, appId: manifest.id, version: manifest.version },
        requestPolicy
      ), policy);
    } catch (error) {
      errors.set(manifest.id, toError(error));
    }
  });
  return errors;
}

/** Builds the default fail-closed policy from deployment configuration. */
export function createRemoteTrustPolicy(config: AtlasHostRuntimeConfig): AtlasRemoteTrustPolicy {
  const baseUrl = globalThis.location?.href ?? "http://atlas.local";
  const origins = [config.catalogUrl, ...(config.assetOrigins ?? []), ...(config.externalRegistryUrls ?? [])]
    .map((value) => new URL(value, baseUrl).origin);
  return { allowedOrigins: new Set(origins) };
}

function parseOverrideDocument(value: string): AtlasRuntimeOverrideDocument {
  try {
    const document: unknown = JSON.parse(value);
    validateOverrideShape(document);
    return document;
  } catch {
    throw new Error(`Invalid Atlas runtime override document in ${ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY}.`);
  }
}

function validateOverrideShape(value: unknown): asserts value is AtlasRuntimeOverrideDocument {
  if (!isRecord(value) || value.schemaVersion !== "1" || typeof value.hostId !== "string"
    || typeof value.generatedAt !== "string" || !Array.isArray(value.overrides)) {
    throw new Error(`Invalid Atlas runtime override document in ${ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY}.`);
  }
  for (const override of value.overrides) {
    if (!isRecord(override) || typeof override.appId !== "string" || !isRecord(override.manifest)
      || typeof override.reason !== "string") {
      throw new Error(`Invalid Atlas runtime override document in ${ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY}.`);
    }
  }
}

function isHostRuntimeConfig(value: unknown): value is AtlasHostRuntimeConfig {
  return isRecord(value) && value.schemaVersion === "1" && typeof value.hostId === "string" && value.hostId.length > 0
    && typeof value.catalogUrl === "string" && value.catalogUrl.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateOverrideDocument(document: AtlasRuntimeOverrideDocument, hostId: string, source: string): void {
  if (document.schemaVersion !== "1" || !Array.isArray(document.overrides)) {
    throw new Error(`Invalid Atlas runtime override document from ${source}.`);
  }
  if (document.hostId !== hostId) {
    throw new Error(`Atlas override targets host "${document.hostId}", but the current host is "${hostId}".`);
  }
  for (const override of document.overrides) {
    if (override.appId !== override.manifest.id) {
      throw new Error(`Atlas override app id "${override.appId}" does not match manifest id "${override.manifest.id}".`);
    }
    try {
      assertAtlasManifest(override.manifest);
    } catch (error) {
      const detail = (error instanceof Error ? error.message : String(error)).replace(/ Suggested action:.*$/u, "");
      throw new Error(actionableMessage(
        `Invalid Atlas override for app "${override.appId}". ${detail}`,
        "Open Columbus, correct or disable this app override, then reload the host."
      ), { cause: error });
    }
  }
}

async function defaultFetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, signal ? { signal } : undefined);
  if (!response.ok) throw new Error(`Failed to fetch Atlas JSON from ${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

async function defaultFetchBytes(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(url, signal ? { signal } : undefined);
  if (!response.ok) throw new Error(`Failed to fetch Atlas asset from ${url}: ${response.status} ${response.statusText}`);
  return response.arrayBuffer();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function assertManifestAssetTrust(manifest: AtlasManifest, policy: AtlasRemoteTrustPolicy = {}): void {
  if (manifest.channel === "local") {
    assertLocalManifestUrls(manifest);
    return;
  }
  assertTrustedAssetUrl(manifest.remoteEntryUrl, manifest.id, "remote", policy);
  assertManifestStylesTrust(manifest, policy);
}

export function assertManifestStylesTrust(manifest: AtlasManifest, policy: AtlasRemoteTrustPolicy = {}): void {
  if (manifest.channel === "local") {
    assertLocalManifestUrls(manifest);
    return;
  }
  for (const stylesheet of manifest.styles ?? []) {
    assertTrustedAssetUrl(stylesheet.href, manifest.id, "stylesheet", policy);
  }
}

function assertTrustedAssetUrl(urlValue: string, appId: string, kind: string, policy: AtlasRemoteTrustPolicy): void {
  const url = new URL(urlValue, globalThis.location?.href ?? "http://atlas.local");
  if (!isHttpProtocol(url.protocol)) throw new Error(`Atlas app "${appId}" uses unsupported ${kind} protocol "${url.protocol}".`);
  if (policy.allowedOrigins && !policy.allowedOrigins.has(url.origin)) {
    throw new Error(`Atlas app "${appId}" uses ${kind} origin "${url.origin}", which is not allowed by host runtime configuration.`);
  }
}

function assertManifestSupportsHost(manifest: AtlasManifest, hostId: string, source: string): void {
  if (!manifest.supportedHosts.includes("*") && !manifest.supportedHosts.includes(hostId)) {
    throw new Error(`Atlas ${source} manifest for app "${manifest.id}" does not support host "${hostId}".`);
  }
}

function assertLocalManifestUrls(manifest: AtlasManifest): void {
  if (manifest.channel !== "local") return;
  const urls = [
    manifest.remoteEntryUrl,
    ...(manifest.styles ?? []).map(({ href }) => href),
    ...(manifest.exportedWidgets ?? []).map(({ remoteEntryUrl }) => remoteEntryUrl)
  ];
  for (const value of urls) {
    const url = new URL(value, globalThis.location?.href ?? "http://atlas.local");
    if (!isHttpProtocol(url.protocol) || !isLoopbackHostname(url.hostname)) {
      throw new Error(`Atlas local app "${manifest.id}" must use loopback HTTP(S) asset URLs.`);
    }
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isHttpProtocol(protocol: string): boolean {
  return protocol === "http:" || protocol === "https:";
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
