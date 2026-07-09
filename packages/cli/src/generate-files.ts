import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AtlasGeneratedFile } from "@atlas/generators";
import { assertWritable, exists, resolveContainedPath } from "./generate-paths.js";

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
