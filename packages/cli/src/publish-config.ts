import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { CliArguments } from "./arguments.js";
import { isPublicationStorage, type AtlasPublicationStorageSource } from "./publication-storage.js";

export interface AtlasPublishConfig {
  /** Publication storage adapter. Atlas still owns ordering, locking, restore, and verification. */
  storage: AtlasPublicationStorageSource;
  /** Deployed hosts verified after catalog activation. */
  runtimeUrls?: string[];
  /** Optional provider-specific CDN invalidation after mutable objects activate. */
  invalidate?: (paths: string[]) => void | Promise<void>;
}

export function defineAtlasPublishConfig(config: AtlasPublishConfig): AtlasPublishConfig {
  return config;
}

export async function loadAtlasPublishConfig(args: CliArguments): Promise<AtlasPublishConfig | undefined> {
  const explicit = args.flag("publish-config");
  const path = resolve(explicit ?? "atlas.publish.ts");
  try {
    const source = await readFile(path, "utf8");
    const transpiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const compiledPath = `${path}.${process.pid}.mjs`;
    await writeFile(compiledPath, transpiled, "utf8");
    try {
      const loaded = await import(`${pathToFileURL(compiledPath).href}?t=${Date.now()}`) as { default?: unknown };
      if (!isPublishConfig(loaded.default)) throw new Error(`${path} must default-export an AtlasPublishConfig object.`);
      return loaded.default;
    } finally {
      await rm(compiledPath, { force: true });
    }
  } catch (error) {
    if (!explicit && isNodeError(error) && error.code === "ENOENT") return undefined;
    throw error;
  }
}

function isPublishConfig(value: unknown): value is AtlasPublishConfig {
  if (typeof value !== "object" || value === null) return false;
  const config = value as AtlasPublishConfig;
  const hasStorage = typeof config.storage === "function"
    || isPublicationStorage(config.storage);
  return (config.runtimeUrls === undefined || (Array.isArray(config.runtimeUrls) && config.runtimeUrls.every((url) => typeof url === "string")))
    && (config.invalidate === undefined || typeof config.invalidate === "function")
    && hasStorage;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}
