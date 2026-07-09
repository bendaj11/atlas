import {
  assertAtlasHostCatalog,
  assertAtlasManifest,
  type AtlasHostCatalog,
  type AtlasHostRuntimeConfig,
  type AtlasManifest
} from "@atlas/schema";
import { runResiliently, type AtlasRetryPolicy } from "../resilience.js";
import { mapWithConcurrency } from "../concurrency.js";

type FetchJson = <T>(url: string, signal?: AbortSignal) => Promise<T>;
type FetchBytes = (url: string, signal?: AbortSignal) => Promise<ArrayBuffer>;

export interface AtlasRuntimeOverride {
  mfId: string;
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
  /** Runtime overrides are ignored unless the host explicitly enables them. */
  enabled?: boolean;
  search?: string;
  storage?: Pick<Storage, "getItem">;
  /** Tab-scoped storage. Its override document takes precedence over origin-wide storage. */
  sessionStorage?: Pick<Storage, "getItem">;
  fetchJson?: FetchJson;
  requestPolicy?: AtlasRetryPolicy;
}

/** Host policy applied before Atlas downloads executable remote metadata. */
export interface AtlasRemoteTrustPolicy {}

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
      ? options.fetchJson<AtlasHostCatalog>(options.catalogUrl, signal)
      : defaultFetchJson<AtlasHostCatalog>(options.catalogUrl, signal),
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
    (signal) => fetchJson<AtlasHostRuntimeConfig>(url, signal),
    { stage: "runtime-config", resource: url },
    requestPolicy
  );
  if (config.schemaVersion !== "1" || !config.hostId || !config.catalogUrl) {
    throw new Error(`Invalid Atlas host runtime configuration from ${url}.`);
  }
  validateRequestPolicy(config);
  if (config.allowAppOverrides !== undefined && typeof config.allowAppOverrides !== "boolean") {
    throw new Error("Atlas host allowAppOverrides must be a boolean.");
  }
  return config;
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
  if (options.enabled !== true) return [];
  const search = options.search ?? globalThis.location?.search ?? "";
  const queryUrl = new URLSearchParams(search).get(ATLAS_OVERRIDE_QUERY_PARAM);
  const storage = options.storage ?? globalThis.localStorage;
  const sessionStorage = options.sessionStorage ?? globalThis.sessionStorage;
  const storedUrl = storage?.getItem(ATLAS_OVERRIDE_STORAGE_KEY) ?? undefined;
  const url = queryUrl ?? storedUrl;
  const storedDocument = sessionStorage?.getItem(ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY)
    ?? storage?.getItem(ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY)
    ?? undefined;
  if (!url && !storedDocument) return [];

  const document = url
    ? await runResiliently(
      (signal) => (options.fetchJson ?? defaultFetchJson)<AtlasRuntimeOverrideDocument>(url, signal),
      { stage: "runtime-overrides", resource: url },
      options.requestPolicy
    )
    : parseOverrideDocument(storedDocument!);
  validateOverrideDocument(document, options.hostId, url ?? ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY);
  return document.overrides;
}

export function resolveRuntimeManifests(catalog: AtlasHostCatalog, overrides: AtlasRuntimeOverride[] = []): AtlasManifest[] {
  const byId = new Map<string, AtlasManifest>();
  for (const manifest of catalog.manifests) {
    if (byId.has(manifest.id)) throw new Error(`Atlas catalog contains multiple selected versions for app "${manifest.id}".`);
    byId.set(manifest.id, manifest);
  }
  const overriddenIds = new Set<string>();
  for (const override of overrides) {
    assertAtlasManifest(override.manifest);
    if (override.mfId !== override.manifest.id) {
      throw new Error(`Atlas override app id "${override.mfId}" does not match manifest id "${override.manifest.id}".`);
    }
    if (overriddenIds.has(override.mfId)) {
      throw new Error(`Atlas overrides contain duplicate entries for app "${override.mfId}".`);
    }
    if (!byId.has(override.mfId)) {
      throw new Error(`Atlas override targets app "${override.mfId}", which is not selected by the host catalog.`);
    }
    assertManifestSupportsHost(override.manifest, catalog.hostId, "override");
    assertLocalManifestUrls(override.manifest);
    const selected = byId.get(override.mfId)!;
    overriddenIds.add(override.mfId);
    byId.set(override.mfId, {
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
  assertWidgetUsesGraph(manifests);
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
        { stage: "integrity", resource: url, mfId: manifest.id, version: manifest.version },
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
  new URL(config.catalogUrl, globalThis.location?.href ?? "http://atlas.local");
  return {};
}

function parseOverrideDocument(value: string): AtlasRuntimeOverrideDocument {
  try {
    return JSON.parse(value) as AtlasRuntimeOverrideDocument;
  } catch {
    throw new Error(`Invalid Atlas runtime override document in ${ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY}.`);
  }
}

function validateOverrideDocument(document: AtlasRuntimeOverrideDocument, hostId: string, source: string): void {
  if (document.schemaVersion !== "1" || !Array.isArray(document.overrides)) {
    throw new Error(`Invalid Atlas runtime override document from ${source}.`);
  }
  if (document.hostId !== hostId) {
    throw new Error(`Atlas override targets host "${document.hostId}", but the current host is "${hostId}".`);
  }
  for (const override of document.overrides) {
    if (override.mfId !== override.manifest.id) {
      throw new Error(`Atlas override app id "${override.mfId}" does not match manifest id "${override.manifest.id}".`);
    }
    assertAtlasManifest(override.manifest);
  }
}

async function defaultFetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, signal ? { signal } : undefined);
  if (!response.ok) throw new Error(`Failed to fetch Atlas JSON from ${url}: ${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
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
  assertTrustedAssetUrl(manifest.remoteEntryUrl, manifest.id, "remote");
  assertManifestStylesTrust(manifest, policy);
}

export function assertManifestStylesTrust(manifest: AtlasManifest, policy: AtlasRemoteTrustPolicy = {}): void {
  if (manifest.channel === "local") {
    assertLocalManifestUrls(manifest);
    return;
  }
  for (const stylesheet of manifest.styles ?? []) {
    assertTrustedAssetUrl(stylesheet.href, manifest.id, "stylesheet");
  }
}

function assertTrustedAssetUrl(urlValue: string, mfId: string, kind: string): void {
  const url = new URL(urlValue, globalThis.location?.href ?? "http://atlas.local");
  if (!isHttpProtocol(url.protocol)) throw new Error(`Atlas app "${mfId}" uses unsupported ${kind} protocol "${url.protocol}".`);
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

function assertWidgetUsesGraph(manifests: AtlasManifest[]): void {
  const exports = new Set(manifests.flatMap((manifest) =>
    (manifest.exportedWidgets ?? []).map((component) => `${manifest.id}/${component.id}`)));
  for (const manifest of manifests) {
    for (const reference of manifest.uses ?? []) {
      if (!exports.has(reference)) {
        throw new Error(`Atlas app "${manifest.id}" uses widget "${reference}", which is not exported by the selected runtime manifests.`);
      }
    }
  }
}

function isHttpProtocol(protocol: string): boolean {
  return protocol === "http:" || protocol === "https:";
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
