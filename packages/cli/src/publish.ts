import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AtlasStaticRegistry } from "@atlas/schema";
import { CliArguments } from "./arguments.js";
import type { AtlasBuildResult } from "./build.js";
import {
  createPublicationStorage,
  type AtlasPublicationObjectMetadata,
  type AtlasPublicationLease,
  type AtlasPublicationStorage
} from "./publication-storage.js";
import { publicationContentType } from "./publication-metadata.js";
import type { AtlasPublishConfig } from "./publish-config.js";
import { resolvePullRequestStatus } from "./pull-request.js";
import {
  prepareStaticRegistry,
  prepareStaticPrRemoval,
  prepareStaticPrReconciliation,
  prepareStaticRollback,
  registryRevision,
  type AtlasArtifactManifest
} from "./static-registry.js";

export { defineAtlasPublishConfig, loadAtlasPublishConfig } from "./publish-config.js";
export type {
  AtlasPublishConfig,
  AtlasPullRequestLookup,
  AtlasPullRequestResolver,
  AtlasPullRequestStatus
} from "./publish-config.js";
export { S3PublicationStorage } from "./publication-storage.js";
export type { AtlasPublicationLease, AtlasPublicationObjectMetadata, AtlasPublicationStorage, S3Options } from "./publication-storage.js";

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const MUTABLE_CACHE_CONTROL = "no-cache";

interface PublicationFile {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly cache: "immutable" | "revalidate";
}

interface StoredPublicationObject {
  readonly bytes: Uint8Array;
  readonly metadata: AtlasPublicationObjectMetadata;
}

interface AtlasPublicationInventory {
  readonly schemaVersion: "1";
  readonly paths: string[];
}

interface MutablePublication {
  readonly files: PublicationFile[];
  readonly replaced: AtlasArtifactManifest[];
}

export interface AtlasPublishResult {
  uploaded: string[];
  dryRun: boolean;
  skippedReason?: string;
  cleanupWarnings: string[];
}

export interface AtlasPublishOptions {
  verify?: () => Promise<void>;
  config?: AtlasPublishConfig;
}

export interface AtlasProjectBuilder {
  build(projectName: string): Promise<AtlasBuildResult>;
}

export interface AtlasRollbackResult extends AtlasPublishResult {
  readonly version: string;
  readonly buildId: string;
}

export interface AtlasPrRemovalResult extends AtlasPublishResult {
  readonly removedBuilds: number;
}

export interface AtlasPrPruneResult extends AtlasPublishResult {
  readonly removedBuilds: number;
  readonly checkedPullRequests: number;
}

export class AtlasPublishService {
  constructor(
    private readonly args: CliArguments,
    private readonly builds: AtlasProjectBuilder
  ) {}

  async run(projectName: string, options: AtlasPublishOptions = {}): Promise<AtlasPublishResult> {
    const build = await this.builds.build(projectName);
    const immutableFiles = await immutablePublicationFiles(build);
    if (this.args.hasFlag("dry-run")) {
      return {
        uploaded: [...immutableFiles.map(({ path }) => path), "registry.json", artifactIndexPath(build)],
        dryRun: true,
        cleanupWarnings: []
      };
    }

    const storage = await createPublicationStorage(options.config?.storage);
    return withPublicationLease(storage, async (lease) => {
      await lease.assertHeld();
      const staleReason = await stalePullRequestReason(build, options.config);
      if (staleReason) {
        return { uploaded: [], dryRun: false, skippedReason: staleReason, cleanupWarnings: [] };
      }
      const current = await readRegistry(storage);
      assertExpectedRegistryRevision(this.args, current);
      const mutable = await mutablePublicationFiles(build, current);
      const orderedFiles = [...immutableFiles, ...publicationOrder(mutable.files)];
      const result = await publishFiles(storage, lease, orderedFiles, options);
      const cleanupWarnings = await cleanupSupersededPublications(storage, mutable.replaced, options.config, lease);
      return { ...result, cleanupWarnings };
    });
  }

  async rollback(
    artifactId: string,
    version: string,
    options: AtlasPublishOptions = {}
  ): Promise<AtlasRollbackResult> {
    if (this.args.hasFlag("dry-run")) {
      throw new Error("Rollback dry runs require live storage and are not supported. Use atlas rollback only after reviewing Columbus history.");
    }
    const storage = await createPublicationStorage(options.config?.storage);
    return withPublicationLease(storage, async (lease) => {
      await lease.assertHeld();
      const current = await readRegistry(storage);
      if (!current) throw new Error("Atlas cannot roll back because publication storage has no registry.json.");
      assertExpectedRegistryRevision(this.args, current);
      const output = await mkdtemp(join(tmpdir(), "atlas-rollback-"));
      try {
        const rollback = await prepareStaticRollback({
          artifactId,
          version,
          ...(this.args.flag("build-id") ? { buildId: this.args.flag("build-id") } : {}),
          current,
          outputDirectory: output
        });
        const files = publicationOrder(await readPublicationDirectory(output));
        const result = await publishFiles(storage, lease, files, options);
        return { ...result, version: rollback.selected.version, buildId: rollback.selected.buildId };
      } finally {
        await rm(output, { recursive: true, force: true });
      }
    });
  }

  async removePr(
    artifactIds: readonly string[],
    prNumber: number,
    options: AtlasPublishOptions = {}
  ): Promise<AtlasPrRemovalResult> {
    if (this.args.hasFlag("dry-run")) {
      throw new Error("PR removal dry runs require live storage and are not supported.");
    }
    const storage = await createPublicationStorage(options.config?.storage);
    return withPublicationLease(storage, async (lease) => {
      await lease.assertHeld();
      const current = await readRegistry(storage);
      if (!current) throw new Error("Atlas cannot remove PR builds because publication storage has no registry.json.");
      assertExpectedRegistryRevision(this.args, current);
      const output = await mkdtemp(join(tmpdir(), "atlas-remove-pr-"));
      try {
        const removal = await prepareStaticPrRemoval({
          artifactIds,
          prNumber,
          current,
          outputDirectory: output
        });
        if (removal.removed.length === 0) {
          return { uploaded: [], dryRun: false, cleanupWarnings: [], removedBuilds: 0 };
        }
        const result = await publishFiles(
          storage,
          lease,
          publicationOrder(await readPublicationDirectory(output)),
          options
        );
        const cleanupWarnings = await cleanupSupersededPublications(storage, removal.removed, options.config, lease);
        return { ...result, cleanupWarnings, removedBuilds: removal.removed.length };
      } finally {
        await rm(output, { recursive: true, force: true });
      }
    });
  }

  async prunePrs(
    artifactIds: readonly string[],
    authoritativeOpenPrNumbers: ReadonlySet<number> | undefined,
    options: AtlasPublishOptions = {}
  ): Promise<AtlasPrPruneResult> {
    if (this.args.hasFlag("dry-run")) {
      throw new Error("PR pruning dry runs require live storage and are not supported.");
    }
    const storage = await createPublicationStorage(options.config?.storage);
    return withPublicationLease(storage, async (lease) => {
      await lease.assertHeld();
      const current = await readRegistry(storage);
      if (!current) throw new Error("Atlas cannot prune PR builds because publication storage has no registry.json.");
      assertExpectedRegistryRevision(this.args, current);
      const scoped = [...current.hosts, ...current.apps].filter((manifest): manifest is PullRequestManifest =>
        artifactIds.includes(manifest.id) && manifest.channel === "pr" && manifest.prNumber !== undefined);
      const pullRequests = uniquePullRequests(scoped);
      const closedPrNumbers = authoritativeOpenPrNumbers
        ? new Set(pullRequests.filter(({ prNumber }) => !authoritativeOpenPrNumbers.has(prNumber)).map(({ prNumber }) => prNumber))
        : await closedPullRequests(pullRequests, options.config);
      if (closedPrNumbers.size === 0) {
        return {
          uploaded: [], dryRun: false, cleanupWarnings: [], removedBuilds: 0,
          checkedPullRequests: pullRequests.length
        };
      }

      const output = await mkdtemp(join(tmpdir(), "atlas-prune-prs-"));
      try {
        const cleanup = await prepareStaticPrReconciliation({
          artifactIds,
          closedPrNumbers,
          current,
          outputDirectory: output
        });
        const result = await publishFiles(storage, lease, publicationOrder(await readPublicationDirectory(output)), options);
        const cleanupWarnings = await cleanupSupersededPublications(storage, cleanup.removed, options.config, lease);
        return {
          ...result,
          cleanupWarnings,
          removedBuilds: cleanup.removed.length,
          checkedPullRequests: pullRequests.length
        };
      } finally {
        await rm(output, { recursive: true, force: true });
      }
    });
  }
}

type PullRequestManifest = AtlasArtifactManifest & { prNumber: number };

function uniquePullRequests(manifests: readonly PullRequestManifest[]): PullRequestManifest[] {
  const pullRequests = new Map<number, PullRequestManifest>();
  for (const manifest of manifests) {
    if (!pullRequests.has(manifest.prNumber)) pullRequests.set(manifest.prNumber, manifest);
  }
  return [...pullRequests.values()];
}

async function closedPullRequests(
  pullRequests: readonly PullRequestManifest[],
  config: AtlasPublishConfig | undefined
): Promise<Set<number>> {
  const closed = new Set<number>();
  for (const manifest of pullRequests) {
    if (!manifest.gitSha) {
      throw new Error(`Atlas cannot reconcile PR build "${manifest.id}" because its manifest lacks prNumber or gitSha.`);
    }
    const status = await resolvePullRequestStatus({
      artifactId: manifest.id,
      prNumber: manifest.prNumber,
      gitSha: manifest.gitSha,
      ...(manifest.gitBranch ? { gitBranch: manifest.gitBranch } : {})
    }, config);
    if (status.state !== "open") closed.add(manifest.prNumber);
  }
  return closed;
}

async function withPublicationLease<T>(
  storage: AtlasPublicationStorage,
  operation: (lease: AtlasPublicationLease) => Promise<T>
): Promise<T> {
  const lease = await storage.acquireLock(publicationOwner());
  let operationError: unknown;
  try {
    return await operation(lease);
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    try {
      await lease.release();
    } catch (releaseError) {
      if (operationError) {
        throw new AggregateError(
          [operationError, releaseError],
          "Atlas publication failed and the deployment lease could not be released cleanly."
        );
      }
      throw releaseError;
    }
  }
}

async function publishFiles(
  storage: AtlasPublicationStorage,
  lease: AtlasPublicationLease,
  files: readonly PublicationFile[],
  options: AtlasPublishOptions
): Promise<AtlasPublishResult> {
  const immutableFiles = files.filter(({ cache }) => cache === "immutable");
  const mutableFiles = files.filter(({ cache }) => cache === "revalidate");
  const previousMutableFiles = new Map<string, StoredPublicationObject | undefined>();
  const createdImmutablePaths: string[] = [];
  const uploaded: string[] = [];

  for (const file of mutableFiles) previousMutableFiles.set(file.path, await readStoredObject(storage, file.path));
  for (const file of immutableFiles) {
    await lease.assertHeld();
    if (await createImmutable(storage, file)) createdImmutablePaths.push(file.path);
    uploaded.push(file.path);
  }
  try {
    for (const file of mutableFiles) {
      await lease.assertHeld();
      await storage.replace(file.path, file.bytes, publicationMetadata(file));
      uploaded.push(file.path);
    }
    await verifyStoredFiles(storage, files);
    await lease.assertHeld();
    await options.config?.invalidate?.(mutableFiles.map(({ path }) => path));
    await options.verify?.();
    await lease.assertHeld();
  } catch (error) {
    try {
      await lease.assertHeld();
      await restoreMutableFiles(storage, previousMutableFiles);
      for (const path of createdImmutablePaths.reverse()) await storage.remove(path);
    } catch (leaseError) {
      throw new AggregateError([error, leaseError], "Publication failed after Atlas lost its deployment lease; automatic restore was skipped to protect the current owner.");
    }
    throw error;
  }
  return { uploaded, dryRun: false, cleanupWarnings: [] };
}

async function stalePullRequestReason(
  build: AtlasBuildResult,
  config: AtlasPublishConfig | undefined
): Promise<string | undefined> {
  if (build.manifest.channel !== "pr") return undefined;
  const { id: artifactId, prNumber, gitSha, gitBranch } = build.manifest;
  if (!prNumber || !gitSha) {
    throw new Error(
      `Atlas PR publication for "${artifactId}" requires both a pull-request number and the actual pull-request head SHA.`
    );
  }
  const status = await resolvePullRequestStatus(
    { artifactId, prNumber, gitSha, ...(gitBranch ? { gitBranch } : {}) },
    config
  );
  if (status.state !== "open") return `pull request #${prNumber} is ${status.state}`;
  if (status.headSha !== gitSha) {
    return `pull request #${prNumber} moved from commit ${gitSha} to ${status.headSha} while this build was running`;
  }
  return undefined;
}

async function immutablePublicationFiles(build: AtlasBuildResult): Promise<PublicationFile[]> {
  const prefix = artifactPrefix(build);
  const artifactFiles = await Promise.all(build.files.map(async (relativePath) => ({
    path: `${prefix}/${normalizePath(relativePath)}`,
    bytes: new Uint8Array(await readFile(join(build.sourceDirectory, relativePath))),
    cache: "immutable" as const
  })));
  const manifestName = build.artifact === "host" ? "host.manifest.json" : "app.manifest.json";
  const manifest = {
    path: `${prefix}/${manifestName}`,
    bytes: new TextEncoder().encode(`${JSON.stringify(build.manifest, null, 2)}\n`),
    cache: "immutable" as const
  };
  const paths = [...artifactFiles.map(({ path }) => path), manifest.path, `${prefix}/atlas-publication.json`].sort();
  const inventory = {
    path: `${prefix}/atlas-publication.json`,
    bytes: new TextEncoder().encode(`${JSON.stringify({ schemaVersion: "1", paths }, null, 2)}\n`),
    cache: "immutable" as const
  };
  return [...artifactFiles, manifest, inventory].sort((left, right) => left.path.localeCompare(right.path));
}

async function mutablePublicationFiles(
  build: AtlasBuildResult,
  current: AtlasStaticRegistry | undefined
): Promise<MutablePublication> {
  const output = await mkdtemp(join(tmpdir(), "atlas-registry-"));
  try {
    const registry = await prepareStaticRegistry(build.manifest, current, output);
    return { files: await readPublicationDirectory(output), replaced: registry.replaced };
  } finally {
    await rm(output, { recursive: true, force: true });
  }
}

async function cleanupSupersededPublications(
  storage: AtlasPublicationStorage,
  replaced: readonly AtlasArtifactManifest[],
  config: AtlasPublishConfig | undefined,
  lease?: AtlasPublicationLease
): Promise<string[]> {
  const warnings: string[] = [];
  for (const manifest of replaced) {
    const prefix = manifestPrefix(manifest);
    try {
      const inventory = await readPublicationInventory(storage, prefix);
      if (!inventory) {
        warnings.push(`Atlas replaced the previous PR build for "${manifest.id}", but ${prefix}/atlas-publication.json is missing; its old immutable objects were retained.`);
        continue;
      }
      for (const path of inventory.paths) {
        await lease?.assertHeld();
        await storage.remove(path);
      }
      await config?.invalidate?.(inventory.paths);
    } catch (error) {
      warnings.push(`Atlas replaced the previous PR build for "${manifest.id}", but could not remove every old object under ${prefix}: ${errorMessage(error)}`);
    }
  }
  return warnings;
}

async function readPublicationInventory(
  storage: AtlasPublicationStorage,
  prefix: string
): Promise<AtlasPublicationInventory | undefined> {
  const bytes = await storage.read(`${prefix}/atlas-publication.json`);
  if (!bytes) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new Error("publication inventory is not valid JSON", { cause: error });
  }
  if (!isPublicationInventory(value) || value.paths.some((path) => !path.startsWith(`${prefix}/`))) {
    throw new Error("publication inventory contains invalid or out-of-scope paths");
  }
  return value;
}

function isPublicationInventory(value: unknown): value is AtlasPublicationInventory {
  if (typeof value !== "object" || value === null) return false;
  const inventory = value as Partial<AtlasPublicationInventory>;
  return inventory.schemaVersion === "1" && Array.isArray(inventory.paths)
    && inventory.paths.every((path) => typeof path === "string" && !path.includes(".."));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readPublicationDirectory(
  root: string,
  relativeDirectory = ""
): Promise<PublicationFile[]> {
  const entries = await readdir(join(root, relativeDirectory), { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const relativePath = join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return readPublicationDirectory(root, relativePath);
    if (!entry.isFile()) throw new Error(`Atlas cannot publish unsupported registry entry "${relativePath}".`);
    return [{
      path: normalizePath(relativePath),
      bytes: new Uint8Array(await readFile(join(root, relativePath))),
      cache: isMutableRegistryPath(relativePath) ? "revalidate" as const : "immutable" as const
    }];
  }));
  return files.flat();
}

async function createImmutable(storage: AtlasPublicationStorage, file: PublicationFile): Promise<boolean> {
  try {
    await storage.create(file.path, file.bytes, publicationMetadata(file));
    return true;
  } catch (error) {
    const existing = await storage.read(file.path);
    const metadata = await storage.inspect(file.path);
    if (existing && metadata && sha256(existing) === sha256(file.bytes)) {
      assertPublicationMetadata(file.path, metadata, publicationMetadata(file));
      return false;
    }
    throw error;
  }
}

async function restoreMutableFiles(
  storage: AtlasPublicationStorage,
  previousFiles: ReadonlyMap<string, StoredPublicationObject | undefined>
): Promise<void> {
  for (const [path, previous] of [...previousFiles].reverse()) {
    if (previous) await storage.replace(path, previous.bytes, previous.metadata);
    else await storage.remove(path);
  }
}

async function readStoredObject(
  storage: AtlasPublicationStorage,
  path: string
): Promise<StoredPublicationObject | undefined> {
  const bytes = await storage.read(path);
  if (!bytes) return undefined;
  const metadata = await storage.inspect(path);
  if (!metadata) throw new Error(`Publication object ${path} disappeared while Atlas held the deployment lock.`);
  return { bytes, metadata };
}

async function verifyStoredFiles(
  storage: AtlasPublicationStorage,
  files: readonly PublicationFile[]
): Promise<void> {
  for (const file of files) {
    const stored = await readStoredObject(storage, file.path);
    if (!stored) throw new Error(`Published object ${file.path} is missing from storage.`);
    if (sha256(stored.bytes) !== sha256(file.bytes)) {
      throw new Error(`Published object ${file.path} does not match local SHA-256.`);
    }
    assertPublicationMetadata(file.path, stored.metadata, publicationMetadata(file));
  }
}

function publicationMetadata(file: PublicationFile): AtlasPublicationObjectMetadata {
  return {
    cacheControl: file.cache === "immutable" ? IMMUTABLE_CACHE_CONTROL : MUTABLE_CACHE_CONTROL,
    contentType: publicationContentType(file.path)
  };
}

function assertPublicationMetadata(
  path: string,
  actual: AtlasPublicationObjectMetadata,
  expected: AtlasPublicationObjectMetadata
): void {
  if (actual.contentType !== expected.contentType) {
    throw new Error(`Published object ${path} has Content-Type "${actual.contentType}"; expected "${expected.contentType}".`);
  }
  if (actual.cacheControl !== expected.cacheControl) {
    throw new Error(`Published object ${path} has Cache-Control "${actual.cacheControl}"; expected "${expected.cacheControl}".`);
  }
}

async function readRegistry(storage: AtlasPublicationStorage): Promise<AtlasStaticRegistry | undefined> {
  const bytes = await storage.read("registry.json");
  if (!bytes) return undefined;
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as AtlasStaticRegistry;
  } catch (error) {
    throw new Error("Atlas registry.json in publication storage is not valid JSON.", { cause: error });
  }
}

function assertExpectedRegistryRevision(args: CliArguments, current: AtlasStaticRegistry | undefined): void {
  const expected = args.flag("expected-registry-revision");
  if (!expected) return;
  const actual = registryRevision(current);
  if (expected !== actual) {
    throw new Error(`Static registry is stale. Expected revision "${expected}", received "${actual}".`);
  }
}

function publicationOrder(files: readonly PublicationFile[]): PublicationFile[] {
  return [...files].sort((left, right) => mutableRank(left.path) - mutableRank(right.path)
    || left.path.localeCompare(right.path));
}

function mutableRank(path: string): number {
  if (path === "registry.json") return 0;
  if (path.endsWith("/index.json")) return 1;
  if (path.endsWith("/catalog.json")) return 3;
  return 2;
}

function artifactPrefix(build: AtlasBuildResult): string {
  const collection = build.artifact === "host" ? "hosts" : "apps";
  return `${collection}/${build.manifest.id}/${build.manifest.version}/${build.manifest.buildId}`;
}

function manifestPrefix(manifest: AtlasArtifactManifest): string {
  const collection = manifest.kind === "host" ? "hosts" : "apps";
  return `${collection}/${manifest.id}/${manifest.version}/${manifest.buildId}`;
}

function artifactIndexPath(build: AtlasBuildResult): string {
  const collection = build.artifact === "host" ? "hosts" : "apps";
  return `${collection}/${build.manifest.id}/index.json`;
}

function publicationOwner(): string {
  if (process.env.GITHUB_RUN_ID) return `github:${process.env.GITHUB_RUN_ID}`;
  if (process.env.CI_PIPELINE_ID) return `gitlab:${process.env.CI_PIPELINE_ID}`;
  if (process.env.BITBUCKET_BUILD_NUMBER) return `bitbucket:${process.env.BITBUCKET_BUILD_NUMBER}`;
  if (process.env.CI_BUILD_ID) return `ci:${process.env.CI_BUILD_ID}`;
  return `pid:${process.pid}`;
}

function isMutableRegistryPath(path: string): boolean {
  const normalized = normalizePath(path);
  return normalized === "registry.json"
    || normalized.endsWith("/index.json")
    || normalized.endsWith("/catalog.json");
}

function normalizePath(path: string): string {
  return path.split("\\").join("/");
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
