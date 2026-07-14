import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@jest/globals";
import { createTestManifest } from "../../testkit/dist/index.js";
import { CliArguments } from "../dist/arguments.js";
import { AtlasBuildService } from "../dist/build.js";
import { createTestWorkspace, emptyRegistry, run } from "./build.driver.js";

process.chdir(fileURLToPath(new URL("../../..", import.meta.url)));

const CATALOG_REACT_ID = "3ae54928-c2c6-491d-b766-6996ce0ef3c8";

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
  expect(manifest.version).toBe("2.3.4");
  expect(manifest.channel).toBe("production");
  expect(manifest.remoteEntryUrl).toBe(`https://cdn.example/atlas/apps/${CATALOG_REACT_ID}/2.3.4/test-build/remoteEntry.json`);
  expect(manifest.exportedWidgets[0].id).toBe("6f4994c1-b95f-4b24-a01a-106dd61aa4fb");
  expect(manifest.exportedWidgets[0].ownerAppId).toBe(CATALOG_REACT_ID);
  expect(manifest.exportedWidgets[0].remoteEntryUrl).toBe(`https://cdn.example/atlas/apps/${CATALOG_REACT_ID}/2.3.4/test-build/remoteEntry.json`);
  expect(manifest.integrity).toMatch(/^sha256-/);
});

test("atlas build requires an explicit registry URL outside the local channel", async () => {
  await expect(run(process.execPath, [
    "packages/cli/dist/index.js", "build", "catalog-react", "--skip-compile"
  ], { env: { ...process.env, ATLAS_REGISTRY_BASE_URL: "" } })).rejects.toThrow(/registry-base-url.*required/);
});

test("atlas rollback requires an explicit registry URL", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-rollback-url-"));
  const snapshot = join(directory, "registry.json");
  await writeFile(snapshot, JSON.stringify(emptyRegistry()));
  await expect(run(process.execPath, [
    "packages/cli/dist/index.js", "rollback", "orders", "--version=1.0.0", `--registry-snapshot=${snapshot}`
  ], { env: { ...process.env, ATLAS_REGISTRY_BASE_URL: "" } })).rejects.toThrow(/registry-base-url.*required/);
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
  expect(first.buildId).toBe(second.buildId);
  expect(second.buildId).not.toBe(included.buildId);
});

test("Angular artifact discovery keeps project folders separate from public UUIDs", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-angular-artifact-"));
  const projectRoot = join(root, "orders-angular");
  const artifactRoot = join(projectRoot, "dist/orders-angular/browser");
  const appId = "7beaafbd-fd95-4506-9359-04f05e5c47de";
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ type: "module" }));
  await writeFile(join(projectRoot, "atlas.config.js"), `export default { type: "app", id: "${appId}", name: "Orders", framework: "angular" };\n`);
  await writeFile(join(artifactRoot, "remoteEntry.json"), "{}\n");
  const project = { id: "@example/orders-angular", root: projectRoot, packageName: "@example/orders-angular", version: "1.0.0", outputPaths: [] };
  const workspace = createTestWorkspace({
    kind: "workspace", root, packageManager: "yarn",
    findProject: async () => project,
    run: async () => {}, spawn: () => { throw new Error("not used"); }, generationRoot: () => root
  });

  const manifest = await new AtlasBuildService(workspace, new CliArguments(["build", "orders-angular", "--skip-compile"]))
    .buildManifest("orders-angular", "production", { skipCompile: true, baseUrl: "https://cdn.example" });

  expect(manifest.remoteEntryUrl).toContain(`/apps/${appId}/1.0.0/`);
});

test("atlas generation rejects project names that can escape the target directory", async () => {
  await expect(run(process.execPath, [
    "packages/cli/dist/index.js", "g", "app", "../outside", "--framework=react"
  ])).rejects.toThrow(/Invalid project name/);
});

test("atlas generates S3 publication adapter config only when explicitly requested", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-publish-config-"));
  await run(process.execPath, [
    "packages/cli/dist/index.js", "generate", "publish-config", `--directory=${directory}`, "--skip-format"
  ]);
  const source = await readFile(join(directory, "atlas.publish.ts"), "utf8");
  expect(source).toMatch(/satisfies AtlasPublishConfig/);
  expect(source).toMatch(/new S3PublicationStorage/);
  expect(source).not.toMatch(/ATLAS_S3_/);
  expect(source).toMatch(/runtimeUrls: \[\]/);
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
  const index = JSON.parse(await readFile(join(publication, `apps/${CATALOG_REACT_ID}/index.json`), "utf8"));
  const plan = JSON.parse(await readFile(publicationPlan, "utf8"));
  expect(registry.apps[0].id).toBe(CATALOG_REACT_ID);
  expect(index.manifests[0].version).toBe("2.3.4");
  expect(plan.registryBaseUrl).toBe("https://artifacts.example.com/atlas");
  expect(plan.baseRevision).toMatch(/^sha256:[a-f0-9]{64}$/);
  expect(plan.registryRevision).toMatch(/^sha256:[a-f0-9]{64}$/);
  expect(plan.uploadOrder).toStrictEqual(["immutable", "revalidate"]);
  expect(plan.files.find((file: { path: string }) => file.path === "registry.json").cache).toBe("revalidate");
  await readFile(join(publication, `apps/${CATALOG_REACT_ID}/2.3.4/test-build/remoteEntry.json`));
});

test("atlas build rejects a stale expected registry revision", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-stale-registry-"));
  const snapshot = join(directory, "registry.json");
  await writeFile(snapshot, JSON.stringify(emptyRegistry()));
  await expect(run(process.execPath, [
    "packages/cli/dist/index.js", "build", "catalog-react", "--skip-compile",
    "--registry-base-url=https://cdn.example/atlas",
    `--registry-snapshot=${snapshot}`,
    "--expected-registry-revision=sha256:stale",
    `--publication-directory=${join(directory, "publication")}`
  ])).rejects.toThrow(/snapshot is stale/);
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
  expect(registry.selections.apps.orders).toStrictEqual({ version: "1.0.0", buildId: "stable" });
  expect(plan.operation).toBe("rollback");
  expect(plan.files.every((file: { cache: string }) => file.cache === "revalidate")).toBe(true);
  expect(plan.files.some((file: { path: string }) => file.path.includes("remoteEntry"))).toBe(false);
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
  expect(first.manifest).toBe(second.manifest);
  expect(first.plan).toStrictEqual(second.plan);
});
