import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const packageDirectories = ["schema", "sdk", "runtime", "generators", "testkit", "cli"];

export async function versionPackages(version, workspaceRoot = root) {
  if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error("Usage: yarn release:version <major.minor.patch[-prerelease]>");
  }

  const manifestPaths = [
    join(workspaceRoot, "package.json"),
    ...packageDirectories.map((directory) => join(workspaceRoot, "packages", directory, "package.json")),
    join(workspaceRoot, "apps/columbus/package.json")
  ];
  for (const path of manifestPaths) {
    const manifest = JSON.parse(await readFile(path, "utf8"));
    manifest.version = version;
    for (const [name, dependencyVersion] of Object.entries(manifest.dependencies ?? {})) {
      if (name.startsWith("@atlas/") && dependencyVersion !== version) manifest.dependencies[name] = version;
    }
    await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  const extensionManifestPath = join(workspaceRoot, "apps/columbus/src/manifest.json");
  const extensionManifest = JSON.parse(await readFile(extensionManifestPath, "utf8"));
  extensionManifest.version = version.split("-")[0];
  await writeFile(extensionManifestPath, `${JSON.stringify(extensionManifest, null, 2)}\n`, "utf8");

  const generatorVersionsPath = join(workspaceRoot, "packages/generators/src/cli/generator-versions.ts");
  const generatorVersions = await readFile(generatorVersionsPath, "utf8");
  if (!/ATLAS_PACKAGE_VERSION = "[^"]+"/.test(generatorVersions)) {
    throw new Error("Atlas generator version declaration was not found.");
  }
  await writeFile(generatorVersionsPath, generatorVersions.replace(
    /ATLAS_PACKAGE_VERSION = "[^"]+"/,
    `ATLAS_PACKAGE_VERSION = "${version}"`
  ), "utf8");

  console.info(`Updated the workspace, ${packageDirectories.length} Atlas packages, Columbus extension, and generator output to ${version}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await versionPackages(process.argv[2]);
}
