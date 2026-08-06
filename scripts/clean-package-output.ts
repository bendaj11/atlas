import { readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const packageRoot = resolve(process.cwd());
const packageJson = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));

if (typeof packageJson.name !== "string" || !packageJson.name.startsWith("@atlas/")) {
  throw new Error(`Refusing to clean non-Atlas package at "${packageRoot}".`);
}

await Promise.all([
  rm(join(packageRoot, "dist"), { recursive: true, force: true }),
  rm(join(packageRoot, "tsconfig.tsbuildinfo"), { force: true }),
]);
