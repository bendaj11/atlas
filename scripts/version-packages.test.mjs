import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { versionPackages } from "./version-packages.mjs";

const packageDirectories = ["contracts", "sdk", "runtime", "generators", "testkit", "cli"];

test("release version propagation updates every version-bearing manifest", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-version-"));
  await writeJson(join(root, "package.json"), { name: "atlas-platform", version: "9.9.9" });
  for (const directory of packageDirectories) {
    await writeJson(join(root, "packages", directory, "package.json"), {
      name: `@atlas/${directory}`,
      version: "9.9.9",
      dependencies: { "@atlas/contracts": "9.9.9", external: "^1.0.0" }
    });
  }
  await writeJson(join(root, "apps/chrome-extension/package.json"), { name: "@atlas/chrome-extension", version: "9.9.9" });
  await writeJson(join(root, "apps/chrome-extension/src/manifest.json"), { manifest_version: 3, version: "9.9.9" });
  const generatorPath = join(root, "packages/generators/src/cli/generator-versions.ts");
  await mkdir(join(generatorPath, ".."), { recursive: true });
  await writeFile(generatorPath, 'export const ATLAS_PACKAGE_VERSION = "9.9.9";\n');

  await versionPackages("1.2.3", root);

  const paths = [
    join(root, "package.json"),
    ...packageDirectories.map((directory) => join(root, "packages", directory, "package.json")),
    join(root, "apps/chrome-extension/package.json"),
    join(root, "apps/chrome-extension/src/manifest.json")
  ];
  for (const path of paths) assert.equal(JSON.parse(await readFile(path, "utf8")).version, "1.2.3");
  assert.match(await readFile(generatorPath, "utf8"), /ATLAS_PACKAGE_VERSION = "1\.2\.3"/);
});

async function writeJson(path, value) {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, `${JSON.stringify(value)}\n`);
}
