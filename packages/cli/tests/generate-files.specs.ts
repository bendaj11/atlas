import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@jest/globals";
import { ensureAtlasGeneratedFilesIgnored } from "../dist/generate-files.js";

test("Atlas ignores generated directories from the workspace root", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "atlas-ignore-workspace-"));
  const projectRoot = join(workspaceRoot, "apps/orders");
  await mkdir(projectRoot, { recursive: true });

  await ensureAtlasGeneratedFilesIgnored(workspaceRoot, projectRoot);

  expect(await readFile(join(workspaceRoot, ".gitignore"), "utf8")).toBe(".atlas/\n");
});

test("Atlas preserves existing ignore rules without duplicating its own rule", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "atlas-ignore-existing-"));
  const projectRoot = join(workspaceRoot, "packages/orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(workspaceRoot, ".gitignore"), "dist/\n.atlas\n", "utf8");

  await ensureAtlasGeneratedFilesIgnored(workspaceRoot, projectRoot);

  expect(await readFile(join(workspaceRoot, ".gitignore"), "utf8")).toBe("dist/\n.atlas\n");
});

test("Atlas uses a project-local ignore file outside the detected workspace", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "atlas-ignore-source-"));
  const externalRoot = await mkdtemp(join(tmpdir(), "atlas-ignore-target-"));

  await ensureAtlasGeneratedFilesIgnored(workspaceRoot, externalRoot);

  expect(await readFile(join(externalRoot, ".gitignore"), "utf8")).toBe(".atlas/\n");
});
