import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "@jest/globals";
import { nextVersion, prepareRelease } from "./prepare-release.mjs";
import { createReleaseWorkspace } from "./prepare-release.driver.js";

test("nextVersion calculates semantic release increments", () => {
  assert.equal(nextVersion("1.2.3", "patch"), "1.2.4");
  assert.equal(nextVersion("1.2.3", "minor"), "1.3.0");
  assert.equal(nextVersion("1.2.3", "major"), "2.0.0");
});

test("prepareRelease increments and propagates the selected version", async () => {
  const root = await createReleaseWorkspace("1.2.3");
  const release = await prepareRelease("minor", root);

  assert.deepEqual(release, { previousVersion: "1.2.3", version: "1.3.0" });
  assert.equal(JSON.parse(await readFile(join(root, "packages/cli/package.json"), "utf8")).version, "1.3.0");
});

test("nextVersion rejects unknown release types", () => {
  assert.throws(() => nextVersion("1.2.3", "automatic"), /patch, minor, major/);
});
