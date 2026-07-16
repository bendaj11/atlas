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
import { prepareStaticRegistry, prepareStaticRollback, registryRevision } from "./static-registry.js";

export { defineAtlasPublishConfig, loadAtlasPublishConfig } from "./publish-config.js";
export type { AtlasPublishConfig } from "./publish-config.js";
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

export interface AtlasPublishResult {
  uploaded: string[];
  dryRun: boolean;
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
        dryRun: true
      };
    }

    const storage = await createPublicationStorage(options.config?.storage);
    return withPublicationLease(storage, async (lease) => {
      await lease.assertHeld();
      const current = await readRegistry(storage);
      assertExpectedRegistryRevision(this.args, current);
      const mutableFiles = await mutablePublicationFiles(build, current);
      const orderedFiles = [...immutableFiles, ...publicationOrder(mutableFiles)];
      return await publishFiles(storage, lease, orderedFiles, options);
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
  return { uploaded, dryRun: false };
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
  return [...artifactFiles, manifest].sort((left, right) => left.path.localeCompare(right.path));
}

async function mutablePublicationFiles(
  build: AtlasBuildResult,
  current: AtlasStaticRegistry | undefined
): Promise<PublicationFile[]> {
  const output = await mkdtemp(join(tmpdir(), "atlas-registry-"));
  try {
    await prepareStaticRegistry(build.manifest, current, output);
    return await readPublicationDirectory(output);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
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
