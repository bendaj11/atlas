import { mkdir, readFile, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { extract, list } from "tar";
import { execute } from "./process.js";

const root = resolve(import.meta.dirname, "..");
const outputDirectory = join(root, "dist/package-verification");
const packageDirectories = ["schema", "sdk", "runtime", "bootstrap", "generators", "testkit", "cli"];
const expectedVersion = await atlasGeneratorVersion();
const canonicalLicense = normalizeText(await readFile(join(root, "LICENSE"), "utf8"));

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await execute("pnpm", ["run", "build"], { cwd: root, stdio: "inherit" });

for (const directory of packageDirectories) {
  await verifyPackage(directory);
}

console.info(`Verified ${packageDirectories.length} Atlas package tarballs.`);

async function verifyPackage(directory) {
  const packageRoot = join(root, "packages", directory);
  const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  validateManifest(manifest, directory);

  const archive = join(outputDirectory, `${directory}.tgz`);
  await execute("pnpm", ["pack", "--out", archive], { cwd: packageRoot });
  const entries = [];
  await list({ file: archive, onReadEntry: (entry) => entries.push(entry.path) });
  assertPacked(entries, "./LICENSE", manifest.name);
  assertPacked(entries, "./README.md", manifest.name);
  assertPacked(entries, manifest.main, manifest.name);
  assertPacked(entries, manifest.types, manifest.name);
  for (const target of exportedTargets(manifest.exports)) assertPacked(entries, target, manifest.name);
  if (entries.some((entry) => entry.endsWith(".map"))) {
    throw new Error(`${manifest.name} contains source maps, which are excluded from public packages.`);
  }
  const packedLicense = await readArchiveFile(archive, "package/LICENSE");
  if (normalizeText(packedLicense) !== canonicalLicense) {
    throw new Error(`${manifest.name} does not contain the canonical repository MIT license.`);
  }
}

function validateManifest(manifest, directory) {
  if (manifest.name !== `@atlas/${directory}`) throw new Error(`Unexpected package name for ${directory}.`);
  if (!manifest.version || !manifest.description) {
    throw new Error(`${manifest.name} is missing release metadata.`);
  }
  if (manifest.license !== "MIT") throw new Error(`${manifest.name} must use the approved MIT license.`);
  if (manifest.version !== expectedVersion) {
    throw new Error(`${manifest.name}@${manifest.version} does not match the generator version ${expectedVersion}.`);
  }
  if (!manifest.main || !manifest.types || !manifest.exports || !manifest.files) {
    throw new Error(`${manifest.name} does not declare a complete package surface.`);
  }
  for (const [dependency, version] of Object.entries(manifest.dependencies ?? {})) {
    if (dependency.startsWith("@atlas/") && version !== manifest.version) {
      throw new Error(`${manifest.name} must pin ${dependency} to the release version ${manifest.version}.`);
    }
  }
}

async function atlasGeneratorVersion() {
  const source = await readFile(join(root, "packages/generators/src/cli/generator-versions.ts"), "utf8");
  const version = source.match(/ATLAS_PACKAGE_VERSION = (["'])([^"']+)\1/)?.[2];
  if (!version) throw new Error("Could not read ATLAS_PACKAGE_VERSION from the generator.");
  return version;
}

function exportedTargets(exports) {
  return Object.values(exports).flatMap((entry) => typeof entry === "string" ? [entry] : Object.values(entry));
}

function assertPacked(entries, target, packageName) {
  const normalized = target.replace(/^\.\//, "package/");
  if (!entries.includes(normalized)) {
    throw new Error(`${packageName} declares ${basename(target)}, but ${target} is absent from its tarball.`);
  }
}

async function readArchiveFile(archive, path) {
  const extractionDirectory = join(outputDirectory, ".extracted", basename(archive, ".tgz"));
  await rm(extractionDirectory, { recursive: true, force: true });
  await mkdir(extractionDirectory, { recursive: true });
  await extract({
    file: archive,
    cwd: extractionDirectory,
    filter: (entryPath) => entryPath === path
  });
  return readFile(join(extractionDirectory, path), "utf8");
}

function normalizeText(value) {
  return value.replace(/\r\n/g, "\n").trimEnd();
}
