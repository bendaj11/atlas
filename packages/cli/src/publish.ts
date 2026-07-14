import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { CliArguments } from "./arguments.js";
import { createPublicationStorage, type AtlasPublicationStorage } from "./publication-storage.js";
import type { AtlasPublishConfig } from "./publish-config.js";

export { defineAtlasPublishConfig, loadAtlasPublishConfig } from "./publish-config.js";
export type { AtlasPublishConfig } from "./publish-config.js";
export { S3PublicationStorage } from "./publication-storage.js";
export type { AtlasPublicationStorage, S3Options } from "./publication-storage.js";

interface PublicationFile {
  path: string;
  cache: "immutable" | "revalidate";
}

interface PublicationPlan {
  schemaVersion: "1";
  baseRevision: string;
  registryRevision: string;
  files: PublicationFile[];
}

export interface AtlasPublishResult {
  uploaded: string[];
  dryRun: boolean;
}

export interface AtlasPublishOptions {
  verify?: () => Promise<void>;
  config?: AtlasPublishConfig;
}

export class AtlasPublishService {
  constructor(private readonly args: CliArguments) {}

  async run(planPath: string, options: AtlasPublishOptions = {}): Promise<AtlasPublishResult> {
    const absolutePlanPath = resolve(planPath);
    const plan = parsePlan(JSON.parse(await readFile(absolutePlanPath, "utf8")) as unknown);
    const sourceRoot = absolutePlanPath.endsWith(".json") ? absolutePlanPath.slice(0, -5) : `${absolutePlanPath}.files`;
    const orderedFiles = publicationOrder(plan.files);
    if (this.args.hasFlag("dry-run")) return { uploaded: orderedFiles.map((file) => file.path), dryRun: true };

    const storage = await createPublicationStorage(options.config?.storage);
    const releaseLock = await storage.acquireLock(process.env.CI_PIPELINE_URL ?? `${process.pid}`);
    try {
      await assertLiveRevision(storage, plan.baseRevision);
      const uploaded: string[] = [];
      const previousMutableFiles = new Map<string, Uint8Array | undefined>();
      const immutableFiles = orderedFiles.filter(({ cache }) => cache === "immutable");
      const mutableFiles = orderedFiles.filter(({ cache }) => cache === "revalidate");
      for (const file of mutableFiles) {
        previousMutableFiles.set(file.path, await storage.read(file.path));
      }
      for (const file of immutableFiles) {
        const bytes = await readPublicationFile(sourceRoot, file.path);
        await storage.create(file.path, bytes, "public, max-age=31536000, immutable");
        uploaded.push(file.path);
      }
      try {
        for (const file of mutableFiles) {
          const bytes = await readPublicationFile(sourceRoot, file.path);
          await storage.replace(file.path, bytes, "no-cache");
          uploaded.push(file.path);
        }
        await options.config?.invalidate?.(mutableFiles.map(({ path }) => path));
        await options.verify?.();
      } catch (error) {
        await restoreMutableFiles(storage, previousMutableFiles);
        throw error;
      }
      return { uploaded, dryRun: false };
    } finally {
      await releaseLock();
    }
  }
}

async function restoreMutableFiles(
  storage: AtlasPublicationStorage,
  previousFiles: ReadonlyMap<string, Uint8Array | undefined>
): Promise<void> {
  for (const [path, bytes] of [...previousFiles].reverse()) {
    if (bytes) await storage.replace(path, bytes, "no-cache");
    else await storage.remove(path);
  }
}

function parsePlan(value: unknown): PublicationPlan {
  if (typeof value !== "object" || value === null) throw new Error("Atlas publication plan must be an object.");
  const plan = value as Partial<PublicationPlan>;
  if (plan.schemaVersion !== "1" || typeof plan.baseRevision !== "string" || typeof plan.registryRevision !== "string" || !Array.isArray(plan.files)) {
    throw new Error("Atlas publication plan is malformed or unsupported.");
  }
  for (const file of plan.files) {
    if (!file || typeof file.path !== "string" || (file.cache !== "immutable" && file.cache !== "revalidate")) {
      throw new Error("Atlas publication plan contains an invalid file entry.");
    }
    assertSafeRelativePath(file.path);
  }
  return plan as PublicationPlan;
}

function publicationOrder(files: PublicationFile[]): PublicationFile[] {
  return [...files].sort((left, right) => {
    const rank = (file: PublicationFile): number => {
      if (file.cache === "immutable") return 0;
      if (file.path === "registry.json") return 1;
      if (file.path.endsWith("/index.json")) return 2;
      if (file.path.endsWith("/catalog.json")) return 4;
      return 3;
    };
    return rank(left) - rank(right) || left.path.localeCompare(right.path);
  });
}

async function assertLiveRevision(storage: AtlasPublicationStorage, expected: string): Promise<void> {
  const bytes = await storage.read("registry.json");
  if (!bytes) {
    const emptyRevision = `sha256:${createHash("sha256").update(JSON.stringify({ hosts: [], apps: [], selections: {} })).digest("hex")}`;
    if (expected !== emptyRevision) throw new Error(`Live registry is missing, but publication expects revision "${expected}".`);
    return;
  }
  const registry = JSON.parse(new TextDecoder().decode(bytes)) as { revision?: unknown };
  if (registry.revision !== expected) throw new Error(`Publication is stale. Expected live registry revision "${expected}", received "${String(registry.revision)}". Rebuild before publishing.`);
}

async function readPublicationFile(root: string, path: string): Promise<Uint8Array> {
  assertSafeRelativePath(path);
  return readFile(join(root, path));
}

function assertSafeRelativePath(path: string): void {
  const normalized = relative(".", path);
  if (!path || normalized === ".." || normalized.startsWith(`..${sep}`) || resolve(path) === path) {
    throw new Error(`Publication path "${path}" must stay inside its publication directory.`);
  }
}
