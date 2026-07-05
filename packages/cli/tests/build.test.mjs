import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { createTestManifest } from "../../testkit/dist/index.js";
import { CliArguments } from "../dist/arguments.js";
import { AtlasBuildService } from "../dist/build.js";

test("atlas build emits a validated deployable manifest", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-build-"));
  const snapshot = join(directory, "registry.json");
  await writeFile(snapshot, JSON.stringify({ schemaVersion: "1", updatedAt: "2026-01-01T00:00:00.000Z", manifests: [] }));
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
  const manifest = JSON.parse(await readFile("examples/mfs/catalog-react/dist/mf.manifest.json", "utf8"));
  assert.equal(manifest.version, "2.3.4");
  assert.equal(manifest.channel, "production");
  assert.equal(manifest.remoteEntryUrl, "https://cdn.example/atlas/catalog-react/2.3.4/test-build/remoteEntry.json");
  assert.equal(manifest.exportedComponents[0].id, "product-count");
  assert.equal(manifest.exportedComponents[0].ownerMfId, "catalog-react");
  assert.equal(manifest.exportedComponents[0].remoteEntryUrl, "https://cdn.example/atlas/catalog-react/2.3.4/test-build/remoteEntry.json");
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
  await writeFile(snapshot, JSON.stringify({ schemaVersion: "1", manifests: [] }));
  await assert.rejects(run(process.execPath, [
    "packages/cli/dist/index.js", "rollback", "orders", "--version=1.0.0", `--registry-snapshot=${snapshot}`
  ], { env: { ...process.env, ATLAS_REGISTRY_BASE_URL: "" } }), /registry-base-url.*required/);
});

test("excluded source maps do not affect the generated build identity", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-build-identity-"));
  const projectRoot = join(root, "orders");
  const artifactRoot = join(projectRoot, "dist");
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(join(projectRoot, "atlas.config.ts"), "export default {};\n");
  await writeFile(join(projectRoot, "atlas.config.js"), 'export default { id: "orders", name: "Orders", framework: "react", route: "/orders", supportedHosts: ["host"], placements: [] };\n');
  await writeFile(join(artifactRoot, "remoteEntry.json"), "{}\n");
  await writeFile(join(artifactRoot, "remoteEntry.js.map"), "first map\n");
  const project = { id: "orders", root: projectRoot, packageName: "orders", version: "1.0.0", outputPaths: [artifactRoot] };
  const workspace = {
    kind: "standalone", root, packageManager: "npm",
    findProject: async () => project,
    run: async () => {}, spawn: () => { throw new Error("not used"); }, generationRoot: () => root
  };
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

test("atlas build prepares provider-neutral files without uploading", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-static-publication-"));
  const snapshot = join(directory, "current-registry.json");
  const publication = join(directory, "publication");
  const publicationPlan = join(directory, "publication-plan.json");
  await writeFile(snapshot, JSON.stringify({ schemaVersion: "1", updatedAt: "2026-01-01T00:00:00.000Z", manifests: [] }));
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
  const index = JSON.parse(await readFile(join(publication, "microfrontends/catalog-react/index.json"), "utf8"));
  const catalog = JSON.parse(await readFile(join(publication, "hosts/demo-react-host/catalog.json"), "utf8"));
  const plan = JSON.parse(await readFile(publicationPlan, "utf8"));
  assert.equal(registry.manifests[0].id, "catalog-react");
  assert.equal(index.manifests[0].version, "2.3.4");
  assert.equal(catalog.manifests[0].id, "catalog-react");
  assert.equal(plan.registryBaseUrl, "https://artifacts.example.com/atlas");
  assert.match(plan.baseRevision, /^sha256:[a-f0-9]{64}$/);
  assert.match(plan.registryRevision, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(plan.uploadOrder, ["immutable", "revalidate"]);
  assert.equal(plan.files.find((file) => file.path === "registry.json").cache, "revalidate");
  await readFile(join(publication, "catalog-react/2.3.4/test-build/remoteEntry.json"));
});

test("atlas build rejects a stale expected registry revision", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-stale-registry-"));
  const snapshot = join(directory, "registry.json");
  await writeFile(snapshot, JSON.stringify({ schemaVersion: "1", updatedAt: "2026-01-01T00:00:00.000Z", manifests: [] }));
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
    manifests: [first, second],
    productionSelections: { orders: { version: "2.0.0", buildId: "latest" } }
  }));

  await run(process.execPath, [
    "packages/cli/dist/index.js", "rollback", "orders", "--version=1.0.0",
    "--registry-base-url=https://cdn.example/atlas",
    `--registry-snapshot=${snapshot}`,
    `--publication-directory=${publication}`,
    `--publication-plan=${planPath}`
  ]);

  const registry = JSON.parse(await readFile(join(publication, "registry.json"), "utf8"));
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  assert.deepEqual(registry.productionSelections.orders, { version: "1.0.0", buildId: "stable" });
  assert.equal(plan.operation, "rollback");
  assert.equal(plan.files.every((file) => file.cache === "revalidate"), true);
  assert.equal(plan.files.some((file) => file.path.includes("remoteEntry")), false);
});

test("atlas build is deterministic with fixed CI metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-deterministic-build-"));
  const snapshot = join(directory, "registry.json");
  await writeFile(snapshot, JSON.stringify({ schemaVersion: "1", updatedAt: "2026-01-01T00:00:00.000Z", manifests: [] }));
  const environment = { ...process.env, ATLAS_CREATED_AT: "2026-02-03T04:05:06.000Z" };
  const build = async (name) => {
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

test("atlas generates a portable Angular host at an explicit directory", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "atlas-generator-"));
  const target = join(temporary, "customer-shell");
  await run(process.execPath, ["packages/cli/dist/index.js", "g", "host", "customer-shell", "--framework=angular", `--directory=${target}`]);
  const runtime = JSON.parse(await readFile(join(target, "public/atlas.runtime.json"), "utf8"));
  const main = await readFile(join(target, "src/main.ts"), "utf8");
  const bootstrap = await readFile(join(target, "src/bootstrap.ts"), "utf8");
  assert.equal(runtime.hostId, "customer-shell");
  assert.match(main, /initFederation/);
  assert.match(bootstrap, /startHost/);
  assert.doesNotMatch(bootstrap, /localhost:4300/);
  assert.equal(runtime.catalogUrl, "http://localhost:4400/hosts/customer-shell/catalog.json");
});

test("atlas generation registers projects with Nx automatically", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-generator-"));
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "acme", private: true, packageManager: "yarn@1.22.22" }));
  await run(process.execPath, [join(process.cwd(), "packages/cli/dist/index.js"), "g", "app", "orders", "--framework=react"], { cwd: root });
  const project = JSON.parse(await readFile(join(root, "apps/orders/project.json"), "utf8"));
  assert.equal(project.name, "orders");
  assert.equal(project.targets.build.executor, "nx:run-commands");
  assert.equal(project.targets["atlas:config"].options.cwd, "apps/orders");
});

test("atlas dev prepares an Angular local override without manual URL editing", async () => {
  const stdout = await run(process.execPath, [
    "packages/cli/dist/index.js",
    "dev",
    "orders-angular",
    "--host=demo-angular-host",
    "--host-url=https://host.example/orders",
    "--port=4511",
    "--control-port=4512",
    "--prepare-only"
  ]);
  const document = JSON.parse(await readFile("examples/mfs/orders-angular/.atlas/local-overrides.json", "utf8"));
  assert.equal(document.schemaVersion, "1");
  assert.equal(document.hostId, "demo-angular-host");
  assert.equal(document.overrides[0].manifest.channel, "local");
  assert.equal(document.overrides[0].manifest.remoteEntryUrl, "http://localhost:4511/remoteEntry.json");
  assert.equal(document.overrides[0].manifest.integrity, undefined);
  assert.match(stdout, /https:\/\/host\.example\/orders\?atlas-override=http%3A%2F%2Flocalhost%3A4512/);
});

test("atlas dev prepares a React Native Federation override", async () => {
  const stdout = await run(process.execPath, [
    "packages/cli/dist/index.js", "dev", "dashboard-react",
    "--host=demo-react-host", "--host-url=https://host.example/dashboard",
    "--port=4513", "--control-port=4514", "--prepare-only"
  ]);
  const document = JSON.parse(await readFile("examples/mfs/dashboard-react/.atlas/local-overrides.json", "utf8"));
  assert.equal(document.overrides[0].manifest.framework, "react");
  assert.equal(document.overrides[0].manifest.remoteEntryUrl, "http://localhost:4513/remoteEntry.json");
  assert.equal(document.overrides[0].manifest.integrity, undefined);
  assert.match(stdout, /https:\/\/host\.example\/dashboard\?atlas-override=/);
});

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "pipe", ...options });
    let stderr = "";
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr)));
  });
}
