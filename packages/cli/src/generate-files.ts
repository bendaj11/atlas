import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import type { AtlasGeneratedFile } from "@atlas/generators";
import { assertWritable, exists, resolveContainedPath } from "./generate-paths.js";

const ATLAS_IGNORE_PATTERN = ".atlas/";
const EQUIVALENT_ATLAS_IGNORE_PATTERNS = new Set([".atlas", ".atlas/", "**/.atlas", "**/.atlas/"]);

export async function existingPackageName(root: string): Promise<string | undefined> {
  try {
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { name?: unknown };
    return typeof packageJson.name === "string" && packageJson.name ? packageJson.name : undefined;
  } catch {
    return undefined;
  }
}

export async function writeGenerated(root: string, files: AtlasGeneratedFile[], force: boolean): Promise<void> {
  await assertWritable(root, force, `Target directory "${root}" already exists. Use --force to update generated files.`);
  for (const file of files) {
    const target = resolveContainedPath(root, file.path);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, file.contents, "utf8");
  }
}

export async function ensureAtlasGeneratedFilesIgnored(workspaceRoot: string, projectRoot: string): Promise<void> {
  const ignoreRoot = isContainedBy(workspaceRoot, projectRoot) ? workspaceRoot : projectRoot;
  const ignorePath = join(ignoreRoot, ".gitignore");
  const existing = await readFileIfPresent(ignorePath);
  if (hasAtlasIgnorePattern(existing)) return;
  const newline = existing.includes("\r\n") ? "\r\n" : "\n";
  const separator = existing.length > 0 && !existing.endsWith("\n") ? newline : "";
  await writeFile(ignorePath, `${existing}${separator}${ATLAS_IGNORE_PATTERN}${newline}`, "utf8");
}

function isContainedBy(parent: string, child: string): boolean {
  const relativePath = relative(parent, child);
  return relativePath === "" || (relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath));
}

async function readFileIfPresent(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) return "";
    throw error;
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function hasAtlasIgnorePattern(source: string): boolean {
  return source.split(/\r?\n/).some((line) => EQUIVALENT_ATLAS_IGNORE_PATTERNS.has(line.trim()));
}

export async function takeOverAppSource(root: string): Promise<void> {
  await rm(resolveContainedPath(root, "src/app"), { recursive: true, force: true });
}

export async function removeDelegatedReactViteConfigs(root: string): Promise<void> {
  await Promise.all([
    "vite.config.mts",
    "vite.config.mjs",
    "vite.config.js",
    "vite.config.cjs",
    "vite.config.cts"
  ].map((path) => rm(resolveContainedPath(root, path), { force: true })));
}

export function addUniqueString(values: unknown[], value: string): unknown[] {
  return values.includes(value) ? values : [...values, value];
}

export { exists };
