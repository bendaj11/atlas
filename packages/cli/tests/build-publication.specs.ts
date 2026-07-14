import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "@jest/globals";
import { createTestManifest } from "../../testkit/dist/index.js";
import { CliArguments } from "../dist/arguments.js";
import { AtlasBuildService } from "../dist/build.js";
import { createTestWorkspace, emptyRegistry, run } from "./build.driver.js";

process.chdir(fileURLToPath(new URL("../../..", import.meta.url)));

test("atlas build emits a validated deployable manifest", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-build-"));
  const snapshot = join(directory, "registry.json");
  await writeFile(snapshot, JSON.stringify(emptyRegistry()));
  await run(process.execPath, [
    "packages/cli/dist/index.js",
    "build",
    "catalog-react",
    "--skip-compile",
    "--version=2.3.4",
    "--build-id=test-build",
    "--registry-base-url=https://cdn.example/atlas",
    `--registry-snapshot=${snapshot}`,
    `--publication-directory=${join(directory, "publication")}`,
    `--publication-plan=${join(directory, "publication.json")}`
  ]);
  const manifest = JSON.parse(await readFile("examples/apps/catalog-react/dist/app.manifest.json", "utf8"));
  assert.equal(manifest.version, "2.3.4");
  assert.equal(manifest.channel, "production");
  assert.equal(manifest.remoteEntryUrl, "https://cdn.example/atlas/apps/catalog-react/2.3.4/test-build/remoteEntry.json");
  assert.equal(manifest.exportedWidgets[0].id, "6f4994c1-b95f-4b24-a01a-106dd61aa4fb");
  assert.equal(manifest.exportedWidgets[0].ownerAppId, "catalog-react");
  assert.equal(manifest.exportedWidgets[0].remoteEntryUrl, "https://cdn.example/atlas/apps/catalog-react/2.3.4/test-build/remoteEntry.json");
  assert.match(manifest.integrity, /^sha256-/);
});

test("atlas build requires an explicit registry URL outside the local channel", async () => {
  await assert.rejects(run(process.execPath, [
    "packages/cli/dist/index.js", "build", "catalog-react", "--skip-compile"
  ], { env: { ...process.env, ATLAS_REGISTRY_BASE_URL: "" } }), /registry-base-url.*required/);
});

test("atlas rollback requires an explicit registry URL", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-rollback-url-"));
  const snapshot = join(directory, "registry.json");
  await writeFile(snapshot, JSON.stringify(emptyRegistry()));
  await assert.rejects(run(process.execPath, [
    "packages/cli/dist/index.js", "rollback", "orders", "--version=1.0.0", `--registry-snapshot=${snapshot}`
  ], { env: { ...process.env, ATLAS_REGISTRY_BASE_URL: "" } }), /registry-base-url.*required/);
});

test("excluded source maps do not affect the generated build identity", async () => {
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
  assert.equal(first.buildId, second.buildId);
  assert.notEqual(second.buildId, included.buildId);
});

test("atlas generation rejects project names that can escape the target directory", async () => {
  await assert.rejects(run(process.execPath, [
    "packages/cli/dist/index.js", "g", "app", "../outside", "--framework=react"
  ]), /Invalid project name/);
});

test("atlas generates S3 publication adapter config only when explicitly requested", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-publish-config-"));
  await run(process.execPath, [
    "packages/cli/dist/index.js", "generate", "publish-config", `--directory=${directory}`, "--skip-format"
  ]);
  const source = await readFile(join(directory, "atlas.publish.ts"), "utf8");
  assert.match(source, /satisfies AtlasPublishConfig/);
  assert.match(source, /new S3PublicationStorage/);
  assert.doesNotMatch(source, /ATLAS_S3_/);
  assert.match(source, /runtimeUrls: \[\]/);
});

test("atlas build prepares provider-neutral files without uploading", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-static-publication-"));
  const snapshot = join(directory, "current-registry.json");
  const publication = join(directory, "publication");
  const publicationPlan = join(directory, "publication-plan.json");
  await writeFile(snapshot, JSON.stringify(emptyRegistry()));
  await run(process.execPath, [
    "packages/cli/dist/index.js",
    "build",
    "catalog-react",
    "--skip-compile",
    "--version=2.3.4",
    "--build-id=test-build",
    "--registry-base-url=https://artifacts.example.com/atlas",
    `--registry-snapshot=${snapshot}`,
    `--publication-directory=${publication}`,
    `--publication-plan=${publicationPlan}`
  ]);
  const registry = JSON.parse(await readFile(join(publication, "registry.json"), "utf8"));
  const index = JSON.parse(await readFile(join(publication, "apps/catalog-react/index.json"), "utf8"));
  const plan = JSON.parse(await readFile(publicationPlan, "utf8"));
  assert.equal(registry.apps[0].id, "catalog-react");
  assert.equal(index.manifests[0].version, "2.3.4");
  assert.equal(plan.registryBaseUrl, "https://artifacts.example.com/atlas");
  assert.match(plan.baseRevision, /^sha256:[a-f0-9]{64}$/);
  assert.match(plan.registryRevision, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(plan.uploadOrder, ["immutable", "revalidate"]);
  assert.equal(plan.files.find((file: { path: string }) => file.path === "registry.json").cache, "revalidate");
  await readFile(join(publication, "apps/catalog-react/2.3.4/test-build/remoteEntry.json"));
});

test("atlas build rejects a stale expected registry revision", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-stale-registry-"));
  const snapshot = join(directory, "registry.json");
  await writeFile(snapshot, JSON.stringify(emptyRegistry()));
  await assert.rejects(run(process.execPath, [
    "packages/cli/dist/index.js", "build", "catalog-react", "--skip-compile",
    "--registry-base-url=https://cdn.example/atlas",
    `--registry-snapshot=${snapshot}`,
    "--expected-registry-revision=sha256:stale",
    `--publication-directory=${join(directory, "publication")}`
  ]), /snapshot is stale/);
});

test("atlas rollback emits only mutable registry files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-rollback-"));
  const first = createTestManifest({ id: "orders", version: "1.0.0", buildId: "stable" });
  const second = createTestManifest({ id: "orders", version: "2.0.0", buildId: "latest" });
  const snapshot = join(directory, "registry.json");
  const publication = join(directory, "rollback");
  const planPath = join(directory, "rollback.json");
  await writeFile(snapshot, JSON.stringify({
    schemaVersion: "1",
    updatedAt: second.createdAt,
    hosts: [],
    apps: [first, second],
    selections: { hosts: {}, apps: { orders: { version: "2.0.0", buildId: "latest" } } }
  }));

  await run(process.execPath, [
    "packages/cli/dist/index.js", "rollback", "orders", "--version=1.0.0",
    "--registry-base-url=https://cdn.example/atlas",
    `--registry-snapshot=${snapshot}`,
    `--publication-directory=${publication}`,
    `--publication-plan=${planPath}`,
    "--prepare-only"
  ]);

  const registry = JSON.parse(await readFile(join(publication, "registry.json"), "utf8"));
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  assert.deepEqual(registry.selections.apps.orders, { version: "1.0.0", buildId: "stable" });
  assert.equal(plan.operation, "rollback");
  assert.equal(plan.files.every((file: { cache: string }) => file.cache === "revalidate"), true);
  assert.equal(plan.files.some((file: { path: string }) => file.path.includes("remoteEntry")), false);
});

test("atlas build is deterministic with fixed CI metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-deterministic-build-"));
  const snapshot = join(directory, "registry.json");
  await writeFile(snapshot, JSON.stringify(emptyRegistry()));
  const environment = { ...process.env, ATLAS_CREATED_AT: "2026-02-03T04:05:06.000Z" };
  const build = async (name: string) => {
    const publication = join(directory, name);
    const plan = join(directory, `${name}.json`);
    await run(process.execPath, [
      "packages/cli/dist/index.js", "build", "catalog-react", "--skip-compile", "--version=3.0.0",
      "--registry-base-url=https://cdn.example/atlas", `--registry-snapshot=${snapshot}`,
      `--publication-directory=${publication}`, `--publication-plan=${plan}`
    ], { env: environment });
    return {
      manifest: await readFile(join(publication, "registry.json"), "utf8"),
      plan: JSON.parse(await readFile(plan, "utf8"))
    };
  };
  const first = await build("first");
  const second = await build("second");
  assert.equal(first.manifest, second.manifest);
  assert.deepEqual(first.plan, second.plan);
});

