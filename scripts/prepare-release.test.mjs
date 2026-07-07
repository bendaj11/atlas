import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { nextVersion, prepareRelease } from "./prepare-release.mjs";

const packageDirectories = ["schema", "sdk", "runtime", "generators", "testkit", "cli"];

test("nextVersion calculates semantic release increments", () => {
  assert.equal(nextVersion("1.2.3", "patch"), "1.2.4");
  assert.equal(nextVersion("1.2.3", "minor"), "1.3.0");
  assert.equal(nextVersion("1.2.3", "major"), "2.0.0");
});

test("prepareRelease increments and propagates the selected version", async () => {
  const root = await createWorkspace("1.2.3");
  const release = await prepareRelease("minor", root);

  assert.deepEqual(release, { previousVersion: "1.2.3", version: "1.3.0" });
  assert.equal(JSON.parse(await readFile(join(root, "packages/cli/package.json"), "utf8")).version, "1.3.0");
});

test("nextVersion rejects unknown release types", () => {
  assert.throws(() => nextVersion("1.2.3", "automatic"), /patch, minor, major/);
});

async function createWorkspace(version) {
  const root = await mkdtemp(join(tmpdir(), "atlas-release-"));
  await writeJson(join(root, "package.json"), { name: "atlas-platform", version });
  for (const directory of packageDirectories) {
    await writeJson(join(root, "packages", directory, "package.json"), {
      name: `@atlas/${directory}`,
      version,
      dependencies: { "@atlas/schema": version }
    });
  }
  await writeJson(join(root, "apps/chrome-extension/package.json"), { version });
  await writeJson(join(root, "apps/chrome-extension/src/manifest.json"), { version });
  const generatorPath = join(root, "packages/generators/src/cli/generator-versions.ts");
  await mkdir(join(generatorPath, ".."), { recursive: true });
  await writeFile(generatorPath, `export const ATLAS_PACKAGE_VERSION = "${version}";\n`);
  return root;
}

async function writeJson(path, value) {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, `${JSON.stringify(value)}\n`);
}
