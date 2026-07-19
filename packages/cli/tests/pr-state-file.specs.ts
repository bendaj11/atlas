import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@jest/globals";
import { readOpenPullRequests } from "../dist/pr-state-file.js";

test("provider-neutral PR state files must be explicitly complete", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-pr-state-"));
  const path = join(root, "open-prs.json");
  await writeFile(path, JSON.stringify({ schemaVersion: "1", openPullRequests: [42] }));

  await expect(readOpenPullRequests(path)).rejects.toThrow(/"complete": true/);
});

test("provider-neutral PR state files return all open PR numbers", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-pr-state-"));
  const path = join(root, "open-prs.json");
  await writeFile(path, JSON.stringify({
    schemaVersion: "1",
    complete: true,
    openPullRequests: [17, 42]
  }));

  expect(await readOpenPullRequests(path)).toStrictEqual(new Set([17, 42]));
});
