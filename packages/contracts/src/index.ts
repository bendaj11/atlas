import { validateHostCatalog } from "./catalog-validation.js";
import { validateManifest } from "./manifest-validation.js";

export type AtlasFramework = "angular" | "react" | "vue";
export type AtlasVersionChannel = "production" | "pr" | "historical" | "local";
export type AtlasPlacementKind = "route" | "slot";
export type AtlasDomIsolation = "scoped" | "shadow-dom";

export interface AtlasRouteContribution {
  id: string;
  basePath: string;
  title: string;
  nav?: {
    label: string;
    order?: number;
    visible?: boolean;
  };
}

export interface AtlasPlacement {
  id: string;
  kind: AtlasPlacementKind;
  hostId: string;
  slot?: string;
  route?: AtlasRouteContribution;
}

export interface AtlasExposeMap {
  entry: string;
  [name: string]: string;
}

/** One immutable stylesheet emitted by an MF build and loaded by the host. */
export interface AtlasStylesheet {
  href: string;
  integrity?: string;
}

export interface AtlasExportedComponentManifest {
  schemaVersion: "1";
  id: string;
  name: string;
  ownerMfId: string;
  framework: AtlasFramework;
  remoteEntryUrl: string;
  expose: string;
  contractVersion: "1";
  metadata?: Record<string, string | number | boolean>;
}

/** Immutable description of one deployable microfrontend build. */
export interface AtlasManifest {
  schemaVersion: "1";
  id: string;
  name: string;
  version: string;
  buildId: string;
  channel: AtlasVersionChannel;
  framework: AtlasFramework;
  /** DOM/CSS boundary. Product dependencies are always bundled per MF. */
  isolation?: AtlasDomIsolation;
  remoteEntryUrl: string;
  /** Global styles the host must load before mounting this MF. */
  styles?: AtlasStylesheet[];
  exposes: AtlasExposeMap;
  exportedComponents?: AtlasExportedComponentManifest[];
  /** Widget references consumed by this MF, formatted as "owner-mf/widget-id". */
  uses?: string[];
  requiredHostSdkVersion: string;
  supportedHosts: string[];
  placements: AtlasPlacement[];
  integrity?: string;
  gitSha?: string;
  prNumber?: number;
  createdAt: string;
  metadata?: Record<string, string | number | boolean>;
}

/** Exact set of MF versions selected for one host runtime. */
export interface AtlasHostCatalog {
  schemaVersion: "1";
  hostId: string;
  generatedAt: string;
  manifests: AtlasManifest[];
}

export interface AtlasMicrofrontendIndex {
  schemaVersion: "1";
  mfId: string;
  updatedAt: string;
  manifests: AtlasManifest[];
}

export interface AtlasStaticRegistry {
  schemaVersion: "1";
  /** SHA-256 revision of the canonical manifest collection. Older registries may omit it. */
  revision?: string;
  updatedAt: string;
  manifests: AtlasManifest[];
  /** Production build selected for each MF. Missing entries fall back to the newest production manifest. */
  productionSelections?: Record<string, AtlasProductionSelection>;
}

export interface AtlasProductionSelection {
  version: string;
  buildId: string;
}

/** Deployment-specific host settings loaded outside the compiled host bundle. */
export interface AtlasHostRuntimeConfig {
  schemaVersion: "1";
  hostId: string;
  catalogUrl: string;
  /** Additional trusted origins for production, PR, and historical remote assets. The catalog origin is always trusted. */
  allowedRemoteOrigins?: string[];
  /** Require SHA-256 integrity metadata for non-local remotes. Defaults to true. */
  requireIntegrity?: boolean;
  /** Allow Chrome extension and atlas dev runtime overrides. Defaults to false. */
  allowRuntimeOverrides?: boolean;
  /** Timeout for runtime configuration, catalog, override, and federation requests. */
  requestTimeoutMs?: number;
  /** Number of retries after the first failed runtime request. Defaults to two. */
  retryAttempts?: number;
  /** Delay between runtime request attempts. */
  retryDelayMs?: number;
  loadTimeoutMs?: number;
  waitForMfReady?: boolean;
  loadingIndicator?: "spinner" | "text" | "none";
}

/** Small developer-owned source configuration consumed by Atlas build tooling. */
export interface AtlasConfig {
  id: string;
  name?: string;
  framework: AtlasFramework;
  isolation?: AtlasDomIsolation;
  hostCompatibility?: string[];
  placements?: AtlasPlacement[];
  /** Widget references consumed by this MF. Atlas resolves their owner MFs into the host catalog. */
  uses?: string[];
  catalogUrl?: string;
  requiredHostSdkVersion?: string;
}

export interface AtlasValidationIssue {
  path: string;
  message: string;
}

export class AtlasValidationError extends Error {
  readonly issues: AtlasValidationIssue[];

  constructor(message: string, issues: AtlasValidationIssue[]) {
    super(message);
    this.name = "AtlasValidationError";
    this.issues = issues;
  }
}

/** Validates untrusted manifest JSON and narrows it to AtlasManifest. */
export function assertAtlasManifest(value: unknown): asserts value is AtlasManifest {
  const issues = validateAtlasManifest(value);
  if (issues.length > 0) {
    throw new AtlasValidationError("Invalid Atlas manifest.", issues);
  }
}

export function validateAtlasManifest(value: unknown): AtlasValidationIssue[] {
  return validateManifest(value);
}

/** Validates untrusted host catalog JSON and narrows it to AtlasHostCatalog. */
export function assertAtlasHostCatalog(value: unknown): asserts value is AtlasHostCatalog {
  const issues = validateAtlasHostCatalog(value);
  if (issues.length > 0) throw new AtlasValidationError("Invalid Atlas host catalog.", issues);
}

export function validateAtlasHostCatalog(value: unknown): AtlasValidationIssue[] {
  return validateHostCatalog(value);
}

/** Converts developer configuration and CI metadata into an immutable runtime manifest. */
export function createManifestFromConfig(input: {
  config: AtlasConfig;
  version: string;
  buildId: string;
  remoteEntryUrl: string;
  channel?: AtlasVersionChannel;
  gitSha?: string;
  prNumber?: number;
  createdAt?: string;
  exportedComponents?: AtlasExportedComponentManifest[];
  styles?: AtlasStylesheet[];
  integrity?: string;
}): AtlasManifest {
  const manifest: AtlasManifest = {
    schemaVersion: "1",
    id: input.config.id,
    name: input.config.name ?? input.config.id,
    version: input.version,
    buildId: input.buildId,
    channel: input.channel ?? "production",
    framework: input.config.framework,
    isolation: input.config.isolation ?? "scoped",
    remoteEntryUrl: input.remoteEntryUrl,
    exposes: { entry: "./entry" },
    requiredHostSdkVersion: input.config.requiredHostSdkVersion ?? "^0.1.0",
    supportedHosts: input.config.hostCompatibility ?? ["*"],
    placements: input.config.placements ?? [],
    createdAt: input.createdAt ?? new Date().toISOString()
  };

  if (input.exportedComponents?.length) {
    manifest.exportedComponents = input.exportedComponents;
  }

  if (input.styles?.length) manifest.styles = input.styles;

  if (input.config.uses?.length) manifest.uses = [...input.config.uses];

  if (input.integrity) manifest.integrity = input.integrity;

  if (input.gitSha) {
    manifest.gitSha = input.gitSha;
  }

  if (input.prNumber) {
    manifest.prNumber = input.prNumber;
  }

  assertAtlasManifest(manifest);
  return manifest;
}
