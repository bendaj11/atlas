import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@jest/globals";
import { CliArguments } from "../dist/arguments.js";
import { AtlasBuildService } from "../dist/build.js";
import { createTestWorkspace, run } from "./build.driver.js";

process.chdir(fileURLToPath(new URL("../../..", import.meta.url)));

const CATALOG_REACT_ID = "3ae54928-c2c6-491d-b766-6996ce0ef3c8";

test("atlas build emits a deployable manifest without publication plans", async () => {
  await run(process.execPath, [
    "packages/cli/dist/index.js", "build", "catalog-react", "--skip-compile",
    "--registry-base-url=https://cdn.example/atlas"
  ]);

  const manifest = JSON.parse(await readFile("examples/apps/catalog-react/dist/app.manifest.json", "utf8"));
  expect(manifest.version).toBe("0.1.0");
  expect(manifest.channel).toBe("production");
  expect(manifest.buildId).toMatch(/^[a-f0-9]{12}$/);
  expect(manifest.remoteEntryUrl).toContain(`https://cdn.example/atlas/apps/${CATALOG_REACT_ID}/0.1.0/${manifest.buildId}/remoteEntry.json`);
  expect(manifest.integrity).toMatch(/^sha256-/);
  await expect(access("examples/apps/catalog-react/dist/atlas-publication.json")).rejects.toMatchObject({ code: "ENOENT" });
});

test("atlas build requires public registry URL outside local development", async () => {
  await expect(run(process.execPath, [
    "packages/cli/dist/index.js", "build", "catalog-react", "--skip-compile"
  ], { env: { ...process.env, ATLAS_REGISTRY_URL: "" } })).rejects.toThrow(/registry-base-url.*required/);
});

test("excluded source maps do not affect content build ID", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-build-identity-"));
  const projectRoot = join(root, "orders");
  const artifactRoot = join(projectRoot, "dist");
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({ type: "module" }));
  await writeFile(join(projectRoot, "atlas.config.ts"), "export default {};\n");
  await writeFile(join(projectRoot, "atlas.config.js"), 'export default { id: "orders", name: "Orders", framework: "react", routes: [{ hostId: "host", basePath: "/orders", title: "Orders" }] };\n');
  await writeFile(join(artifactRoot, "remoteEntry.json"), "{}\n");
  await writeFile(join(artifactRoot, "remoteEntry.js.map"), "first map\n");
  const project = { id: "orders", root: projectRoot, packageName: "orders", version: "1.0.0", outputPaths: [artifactRoot] };
  const workspace = createTestWorkspace({
    kind: "standalone", root, packageManager: "npm",
    findProject: async () => project,
    run: async () => {}, spawn: () => { throw new Error("not used"); }, generationRoot: () => root
  });
  const args = new CliArguments(["build", "orders", "--skip-compile", "--channel=local"]);
  const first = await new AtlasBuildService(workspace, args).buildManifest("orders");
  await writeFile(join(artifactRoot, "remoteEntry.js.map"), "different map\n");
  const second = await new AtlasBuildService(workspace, args).buildManifest("orders");
  const included = await new AtlasBuildService(workspace, new CliArguments([
    "build", "orders", "--skip-compile", "--channel=local", "--include-source-maps"
  ])).buildManifest("orders");
  expect(first.buildId).toBe(second.buildId);
  expect(second.buildId).not.toBe(included.buildId);
});

test("PR identity is inferred from standard CI metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-pr-identity-"));
  const projectRoot = join(root, "orders");
  const artifactRoot = join(projectRoot, "dist");
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({ type: "module" }));
  await writeFile(join(projectRoot, "atlas.config.ts"), "export default {};\n");
  await writeFile(join(projectRoot, "atlas.config.js"), 'export default { id: "orders", name: "Orders", framework: "react" };\n');
  await writeFile(join(artifactRoot, "remoteEntry.json"), "{}\n");
  const project = { id: "orders", root: projectRoot, packageName: "orders", version: "2.4.0", outputPaths: [artifactRoot] };
  const workspace = createTestWorkspace({ root, findProject: async () => project });
  const previousPr = process.env.CI_MERGE_REQUEST_IID;
  const previousSha = process.env.CI_COMMIT_SHA;
  process.env.CI_MERGE_REQUEST_IID = "42";
  process.env.CI_COMMIT_SHA = "abcdef1234567890";
  try {
    const manifest = await new AtlasBuildService(workspace, new CliArguments([
      "build", "orders", "--skip-compile", "--registry-base-url=https://cdn.example"
    ])).buildManifest("orders", undefined, { skipCompile: true });
    expect(manifest.channel).toBe("pr");
    expect(manifest.version).toBe("2.4.0-pr.42");
    expect(manifest.prNumber).toBe(42);
    expect(manifest.gitSha).toBe("abcdef1234567890");
  } finally {
    restoreEnvironment("CI_MERGE_REQUEST_IID", previousPr);
    restoreEnvironment("CI_COMMIT_SHA", previousSha);
  }
});

test("Angular artifact discovery separates workspace name from public UUID", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-angular-artifact-"));
  const projectRoot = join(root, "orders-angular");
  const artifactRoot = join(projectRoot, "dist/orders-angular/browser");
  const appId = "7beaafbd-fd95-4506-9359-04f05e5c47de";
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ type: "module" }));
  await writeFile(join(projectRoot, "atlas.config.js"), `export default { type: "app", id: "${appId}", name: "Orders", framework: "angular" };\n`);
  await writeFile(join(artifactRoot, "remoteEntry.json"), "{}\n");
  const project = { id: "@example/orders-angular", root: projectRoot, packageName: "@example/orders-angular", version: "1.0.0", outputPaths: [] };
  const workspace = createTestWorkspace({ kind: "workspace", root, packageManager: "yarn", findProject: async () => project });

  const manifest = await new AtlasBuildService(workspace, new CliArguments(["build", "orders-angular", "--skip-compile"]))
    .buildManifest("orders-angular", "production", { skipCompile: true, baseUrl: "https://cdn.example" });

  expect(manifest.remoteEntryUrl).toContain(`/apps/${appId}/1.0.0/`);
});

test("atlas generation rejects project names escaping target directory", async () => {
  await expect(run(process.execPath, [
    "packages/cli/dist/index.js", "g", "app", "../outside", "--framework=react"
  ])).rejects.toThrow(/Invalid project name/);
});

test("atlas build is deterministic with fixed build metadata", async () => {
  const environment = { ...process.env, ATLAS_CREATED_AT: "2026-02-03T04:05:06.000Z" };
  await run(process.execPath, [
    "packages/cli/dist/index.js", "build", "catalog-react", "--skip-compile",
    "--registry-base-url=https://cdn.example/atlas"
  ], { env: environment });
  const first = await readFile("examples/apps/catalog-react/dist/app.manifest.json", "utf8");
  await run(process.execPath, [
    "packages/cli/dist/index.js", "build", "catalog-react", "--skip-compile",
    "--registry-base-url=https://cdn.example/atlas"
  ], { env: environment });
  expect(await readFile("examples/apps/catalog-react/dist/app.manifest.json", "utf8")).toBe(first);
});

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
