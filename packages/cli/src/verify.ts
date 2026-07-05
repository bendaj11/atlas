import { createHash } from "node:crypto";
import {
  assertAtlasManifest,
  type AtlasHostCatalog,
  type AtlasHostRuntimeConfig,
  type AtlasManifest
} from "@atlas/contracts";

export type AtlasVerificationStatus = "pass" | "warning" | "failure";

export interface AtlasVerificationCheck {
  status: AtlasVerificationStatus;
  subject: string;
  message: string;
}

export interface AtlasVerificationReport {
  runtimeUrl: string;
  hostId?: string;
  checks: AtlasVerificationCheck[];
  failures: number;
  warnings: number;
}

export interface AtlasVerifyOptions {
  runtimeUrl: string;
  hostOrigin?: string;
  timeoutMs?: number;
}

const DEFAULT_NETWORK_CONCURRENCY = 8;
const DEFAULT_NETWORK_TIMEOUT_MS = 10_000;

interface VerificationContext {
  runtimeUrl: URL;
  hostOrigin: string;
  timeoutMs: number;
  checks: AtlasVerificationCheck[];
}

interface AssetExpectation {
  url: string;
  subject: string;
  integrity?: string;
  contentType: "json" | "css";
  requireIntegrity: boolean;
  trusted: boolean;
  inspectFederationReferences?: boolean;
}

export class AtlasVerifyService {
  private readonly network: NetworkLimiter;

  constructor(private readonly fetchResource: typeof fetch = fetch, concurrency = DEFAULT_NETWORK_CONCURRENCY) {
    this.network = new NetworkLimiter(concurrency);
  }

  async run(options: AtlasVerifyOptions): Promise<AtlasVerificationReport> {
    const runtimeUrl = absoluteHttpUrl(options.runtimeUrl, "--runtime-url");
    const timeoutMs = options.timeoutMs ?? DEFAULT_NETWORK_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Verification timeout must be a positive finite number.");
    const context: VerificationContext = {
      runtimeUrl,
      hostOrigin: options.hostOrigin ? httpOrigin(options.hostOrigin, "--host-origin") : runtimeUrl.origin,
      timeoutMs,
      checks: []
    };

    const runtime = await this.fetchRuntime(context);
    if (!runtime) return createReport(context);
    const catalog = await this.fetchCatalog(runtime, context);
    if (!catalog) return createReport(context, runtime.hostId);

    this.verifyCatalog(runtime, catalog, context);
    await Promise.all(catalog.manifests.flatMap((manifest) => this.verifyManifestAssets(manifest, runtime, context)));
    return createReport(context, runtime.hostId);
  }

  private async fetchRuntime(context: VerificationContext): Promise<AtlasHostRuntimeConfig | undefined> {
    const response = await this.fetch(context.runtimeUrl, "runtime configuration", context);
    if (!response) return undefined;
    this.verifyMutableCache(response, "runtime configuration", context);
    const value = await parseJson(response, "runtime configuration", context);
    if (!isRuntimeConfig(value)) {
      fail(context, "runtime configuration", "Expected schemaVersion, hostId, and catalogUrl.");
      return undefined;
    }
    pass(context, "runtime configuration", `Loaded host "${value.hostId}".`);
    return value;
  }

  private async fetchCatalog(runtime: AtlasHostRuntimeConfig, context: VerificationContext): Promise<AtlasHostCatalog | undefined> {
    const catalogUrl = new URL(runtime.catalogUrl, context.runtimeUrl);
    const response = await this.fetch(catalogUrl, "host catalog", context);
    if (!response) return undefined;
    this.verifyCors(response, catalogUrl, "host catalog", context);
    this.verifyMutableCache(response, "host catalog", context);
    const value = await parseJson(response, "host catalog", context);
    if (!isHostCatalog(value)) {
      fail(context, "host catalog", "Expected schemaVersion, hostId, generatedAt, and manifests.");
      return undefined;
    }
    pass(context, "host catalog", `Loaded ${value.manifests.length} selected microfrontend(s).`);
    return value;
  }

  private verifyCatalog(runtime: AtlasHostRuntimeConfig, catalog: AtlasHostCatalog, context: VerificationContext): void {
    if (catalog.hostId === runtime.hostId) pass(context, "catalog host", `Matches "${runtime.hostId}".`);
    else fail(context, "catalog host", `Expected "${runtime.hostId}", received "${catalog.hostId}".`);

    const ids = new Set<string>();
    for (const manifest of catalog.manifests) {
      try {
        assertAtlasManifest(manifest);
        pass(context, `${manifest.id} manifest`, `${manifest.version} (${manifest.buildId}) is valid.`);
      } catch (error) {
        fail(context, `${manifest.id || "unknown"} manifest`, errorMessage(error));
      }
      if (ids.has(manifest.id)) fail(context, "catalog versions", `MF "${manifest.id}" is selected more than once.`);
      ids.add(manifest.id);
    }
    if (ids.size === catalog.manifests.length) pass(context, "catalog versions", "Exactly one version is selected per MF.");
    this.verifyWidgetReferences(catalog.manifests, context);
    this.verifyRouteOwnership(catalog, context);
  }

  private verifyWidgetReferences(manifests: AtlasManifest[], context: VerificationContext): void {
    const exports = new Set(manifests.flatMap((manifest) =>
      (manifest.exportedComponents ?? []).map((component) => `${manifest.id}/${component.id}`)));
    const missing = manifests.flatMap((manifest) =>
      (manifest.uses ?? []).filter((reference) => !exports.has(reference)).map((reference) => `${manifest.id} -> ${reference}`));
    if (missing.length > 0) fail(context, "exported components", `Missing: ${missing.join(", ")}.`);
    else pass(context, "exported components", "All consumed components resolve in the catalog.");
  }

  private verifyRouteOwnership(catalog: AtlasHostCatalog, context: VerificationContext): void {
    const owners = new Map<string, string>();
    const conflicts: string[] = [];
    for (const manifest of catalog.manifests) {
      for (const placement of manifest.placements) {
        if (placement.hostId !== catalog.hostId || placement.kind !== "route" || !placement.route) continue;
        const owner = owners.get(placement.route.basePath);
        if (owner && owner !== manifest.id) conflicts.push(`${placement.route.basePath} (${owner}, ${manifest.id})`);
        owners.set(placement.route.basePath, manifest.id);
      }
    }
    if (conflicts.length > 0) fail(context, "route ownership", `Conflicting routes: ${conflicts.join(", ")}.`);
    else pass(context, "route ownership", "Every exact base path has one owner.");
  }

  private verifyManifestAssets(
    manifest: AtlasManifest,
    runtime: AtlasHostRuntimeConfig,
    context: VerificationContext
  ): Promise<void>[] {
    const catalogOrigin = new URL(runtime.catalogUrl, context.runtimeUrl).origin;
    const trustedOrigins = new Set([catalogOrigin, ...(runtime.allowedRemoteOrigins ?? [])]);
    const trusts = (url: string): boolean => manifest.channel === "local" || trustedOrigins.has(new URL(url, context.runtimeUrl).origin);
    const assets: AssetExpectation[] = [
      {
        url: manifest.remoteEntryUrl,
        subject: `${manifest.id} remote entry`,
        integrity: manifest.integrity,
        contentType: "json",
        requireIntegrity: runtime.requireIntegrity !== false,
        trusted: trusts(manifest.remoteEntryUrl),
        inspectFederationReferences: true
      },
      ...(manifest.styles ?? []).map((style, index): AssetExpectation => ({
        url: style.href,
        subject: `${manifest.id} stylesheet ${index + 1}`,
        integrity: style.integrity,
        contentType: "css",
        requireIntegrity: runtime.requireIntegrity !== false,
        trusted: trusts(style.href)
      }))
    ];
    return assets.map((asset) => this.verifyAsset(asset, manifest, context));
  }

  private async verifyAsset(asset: AssetExpectation, manifest: AtlasManifest, context: VerificationContext): Promise<void> {
    const url = new URL(asset.url, context.runtimeUrl);
    if (!asset.trusted) {
      fail(context, `${asset.subject} origin`, `${url.origin} is not allowed by the host runtime configuration.`);
      return;
    }
    pass(context, `${asset.subject} origin`, `${url.origin} is trusted.`);
    const response = await this.fetch(url, asset.subject, context);
    if (!response) return;
    this.verifyCors(response, url, asset.subject, context);
    verifyContentType(response, asset, context);
    verifyImmutableCache(response, asset.subject, manifest.channel, context);
    const bytes = new Uint8Array(await response.arrayBuffer());
    verifyIntegrity(bytes, asset, manifest.channel, context);
    if (asset.inspectFederationReferences) await this.verifyFederationReferences(bytes, url, manifest, context);
  }

  private async verifyFederationReferences(
    bytes: Uint8Array,
    remoteEntryUrl: URL,
    manifest: AtlasManifest,
    context: VerificationContext
  ): Promise<void> {
    const metadata = parseFederationMetadata(bytes, manifest.id, context);
    if (!metadata) return;
    const exposedKeys = new Set(metadata.map((entry) => entry.key));
    const requiredExposes = new Set([
      ...Object.values(manifest.exposes),
      ...(manifest.exportedComponents ?? []).map((component) => component.expose)
    ]);
    const missingExposes = [...requiredExposes].filter((expose) => !exposedKeys.has(expose));
    if (missingExposes.length > 0) fail(context, `${manifest.id} federation exposes`, `Missing: ${missingExposes.join(", ")}.`);
    else pass(context, `${manifest.id} federation exposes`, "Manifest exposes are present in remote metadata.");

    await Promise.all(metadata.map(async (entry) => {
      const subject = `${manifest.id} expose ${entry.key}`;
      const url = new URL(entry.outFileName, remoteEntryUrl);
      const response = await this.fetch(url, subject, context);
      if (!response) return;
      this.verifyCors(response, url, subject, context);
      verifyJavaScriptContentType(response, subject, context);
      verifyImmutableCache(response, subject, manifest.channel, context);
    }));
  }

  private async fetch(url: URL, subject: string, context: VerificationContext): Promise<Response | undefined> {
    try {
      const response = await this.network.run(() => this.fetchResource(url, {
        headers: { Origin: context.hostOrigin },
        cache: "no-store",
        signal: AbortSignal.timeout(context.timeoutMs)
      }));
      if (!response.ok) {
        fail(context, subject, `${url.href} returned ${response.status} ${response.statusText}.`);
        return undefined;
      }
      return response;
    } catch (error) {
      fail(context, subject, `${url.href} could not be fetched: ${errorMessage(error)}`);
      return undefined;
    }
  }

  private verifyCors(response: Response, url: URL, subject: string, context: VerificationContext): void {
    if (url.origin === context.hostOrigin) return;
    const allowed = response.headers.get("access-control-allow-origin");
    if (allowed === "*" || allowed === context.hostOrigin) pass(context, `${subject} CORS`, `Allows ${context.hostOrigin}.`);
    else fail(context, `${subject} CORS`, `Expected Access-Control-Allow-Origin for ${context.hostOrigin}.`);
  }

  private verifyMutableCache(response: Response, subject: string, context: VerificationContext): void {
    const cacheControl = response.headers.get("cache-control") ?? "";
    if (/\bimmutable\b/i.test(cacheControl)) fail(context, `${subject} cache`, "Mutable metadata must not be immutable.");
    else if (!cacheControl) warn(context, `${subject} cache`, "No Cache-Control header; use revalidation or a short max-age.");
    else pass(context, `${subject} cache`, cacheControl);
  }
}

class NetworkLimiter {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error("Verification concurrency must be a positive integer.");
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active += 1;
    try {
      return await operation();
    } finally {
      this.active -= 1;
      this.waiting.shift()?.();
    }
  }
}

function verifyContentType(response: Response, asset: AssetExpectation, context: VerificationContext): void {
  const actual = response.headers.get("content-type")?.toLowerCase() ?? "";
  const valid = asset.contentType === "json" ? actual.includes("json") : actual.includes("text/css");
  if (valid) pass(context, `${asset.subject} MIME`, actual);
  else fail(context, `${asset.subject} MIME`, `Expected ${asset.contentType === "json" ? "JSON" : "text/css"}, received "${actual || "missing"}".`);
}

function verifyJavaScriptContentType(response: Response, subject: string, context: VerificationContext): void {
  const actual = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (actual.includes("javascript")) pass(context, `${subject} MIME`, actual);
  else fail(context, `${subject} MIME`, `Expected JavaScript, received "${actual || "missing"}".`);
}

function verifyImmutableCache(response: Response, subject: string, channel: AtlasManifest["channel"], context: VerificationContext): void {
  if (channel === "local") return;
  const cacheControl = response.headers.get("cache-control") ?? "";
  const maxAge = cacheControl.match(/(?:^|,)\s*max-age\s*=\s*(\d+)\b/i)?.[1];
  if (/\bimmutable\b/i.test(cacheControl) && maxAge !== undefined && Number(maxAge) > 0) pass(context, `${subject} cache`, cacheControl);
  else warn(context, `${subject} cache`, "Versioned assets should use Cache-Control: public, max-age=31536000, immutable.");
}

function verifyIntegrity(bytes: Uint8Array, asset: AssetExpectation, channel: AtlasManifest["channel"], context: VerificationContext): void {
  if (!asset.integrity) {
    if (channel === "local") warn(context, `${asset.subject} integrity`, "Skipped for a local manifest.");
    else if (asset.requireIntegrity) fail(context, `${asset.subject} integrity`, "Missing SHA-256 integrity metadata.");
    else warn(context, `${asset.subject} integrity`, "Not required by this host runtime configuration.");
    return;
  }
  const actual = `sha256-${createHash("sha256").update(bytes).digest("base64")}`;
  if (actual === asset.integrity) pass(context, `${asset.subject} integrity`, "SHA-256 matches.");
  else fail(context, `${asset.subject} integrity`, "SHA-256 does not match the manifest.");
}

async function parseJson(response: Response, subject: string, context: VerificationContext): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    fail(context, subject, `Invalid JSON: ${errorMessage(error)}`);
    return undefined;
  }
}

function isRuntimeConfig(value: unknown): value is AtlasHostRuntimeConfig {
  const record = asRecord(value);
  return record?.schemaVersion === "1" && nonEmptyString(record.hostId) && nonEmptyString(record.catalogUrl);
}

function isHostCatalog(value: unknown): value is AtlasHostCatalog {
  const record = asRecord(value);
  return record?.schemaVersion === "1" && nonEmptyString(record.hostId) &&
    nonEmptyString(record.generatedAt) && Array.isArray(record.manifests);
}

function parseFederationMetadata(
  bytes: Uint8Array,
  mfId: string,
  context: VerificationContext
): { key: string; outFileName: string }[] | undefined {
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    const record = asRecord(value);
    if (!Array.isArray(record?.exposes)) throw new Error("Expected an exposes array.");
    return record.exposes.map((candidate) => {
      const expose = asRecord(candidate);
      if (!nonEmptyString(expose?.key) || !nonEmptyString(expose.outFileName)) {
        throw new Error("Every expose requires key and outFileName.");
      }
      return { key: expose.key, outFileName: expose.outFileName };
    });
  } catch (error) {
    fail(context, `${mfId} federation metadata`, errorMessage(error));
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function absoluteHttpUrl(value: string, flag: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${flag} must be an absolute HTTP(S) URL.`); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`${flag} must be an absolute HTTP(S) URL.`);
  return url;
}

function httpOrigin(value: string, flag: string): string {
  return absoluteHttpUrl(value, flag).origin;
}

function createReport(context: VerificationContext, hostId?: string): AtlasVerificationReport {
  return {
    runtimeUrl: context.runtimeUrl.href,
    ...(hostId ? { hostId } : {}),
    checks: context.checks,
    failures: context.checks.filter((check) => check.status === "failure").length,
    warnings: context.checks.filter((check) => check.status === "warning").length
  };
}

function pass(context: VerificationContext, subject: string, message: string): void {
  context.checks.push({ status: "pass", subject, message });
}

function warn(context: VerificationContext, subject: string, message: string): void {
  context.checks.push({ status: "warning", subject, message });
}

function fail(context: VerificationContext, subject: string, message: string): void {
  context.checks.push({ status: "failure", subject, message });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
