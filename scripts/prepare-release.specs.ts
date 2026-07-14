import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@jest/globals";
import { nextVersion, prepareRelease } from "./prepare-release.js";
import { createReleaseWorkspace } from "./prepare-release.driver.js";

test("nextVersion calculates semantic release increments", () => {
  expect(nextVersion("1.2.3", "patch")).toBe("1.2.4");
  expect(nextVersion("1.2.3", "minor")).toBe("1.3.0");
  expect(nextVersion("1.2.3", "major")).toBe("2.0.0");
});

test("prepareRelease increments and propagates the selected version", async () => {
  const root = await createReleaseWorkspace("1.2.3");
  const release = await prepareRelease("minor", root);

  expect(release).toStrictEqual({ previousVersion: "1.2.3", version: "1.3.0" });
  expect(JSON.parse(await readFile(join(root, "packages/cli/package.json"), "utf8")).version).toBe("1.3.0");
});

test("nextVersion rejects unknown release types", () => {
  expect(() => nextVersion("1.2.3", "automatic")).toThrow(/patch, minor, major/);
});
