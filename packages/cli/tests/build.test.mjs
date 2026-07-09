import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { access, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createTestManifest } from "../../testkit/dist/index.js";
import { generateHostFiles, generateAppFiles, generateWidgetFiles } from "../../generators/dist/index.js";
import { CliArguments } from "../dist/arguments.js";
import { AtlasBuildService } from "../dist/build.js";
import { AtlasDevService, createDevSession, createLocalDevCatalog, remoteEntryIsReady } from "../dist/dev.js";
import { loadWorkspaceEnv } from "../dist/env.js";

process.chdir(fileURLToPath(new URL("../../..", import.meta.url)));

const ATLAS_PACKAGE_RANGE = `^${JSON.parse(await readFile(new URL("../../generators/package.json", import.meta.url), "utf8")).version}`;

test("generators keep component declarations split across files", () => {
  for (const framework of ["angular", "react"]) {
    const options = { name: "orders", framework };
    const files = [
      ...generateHostFiles(options),
      ...generateAppFiles(options),
      ...generateWidgetFiles({ name: "order-status", framework })
    ];
    for (const file of files) {
      assertSingleComponentDeclaration(file.path, file.contents);
      if (framework === "react") assert.doesNotMatch(file.contents, /import\.meta\.hot/);
    }
  }
});

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
  assert.equal(manifest.exportedWidgets[0].id, "product-count");
  assert.equal(manifest.exportedWidgets[0].ownerMfId, "catalog-react");
  assert.equal(manifest.exportedWidgets[0].remoteEntryUrl, "https://cdn.example/atlas/catalog-react/2.3.4/test-build/remoteEntry.json");
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
  await writeFile(join(projectRoot, "atlas.config.js"), 'export default { id: "orders", name: "Orders", framework: "react", routes: [{ hostId: "host", basePath: "/orders", title: "Orders" }] };\n');
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
  const target = join(temporary, "customer-host");
  await run(process.execPath, ["packages/cli/dist/index.js", "g", "host", "customer-host", "--framework=angular", "--skip-install", `--directory=${target}`]);
  const main = await readFile(join(target, "src/main.ts"), "utf8");
  const bootstrap = await readFile(join(target, "src/bootstrap.ts"), "utf8");
  await assert.rejects(access(join(target, "public/atlas.runtime.json")), { code: "ENOENT" });
  assert.match(await readFile(join(target, "atlas.config.ts"), "utf8"), /resourcesTimeoutMs: 15000/);
  assert.doesNotMatch(await readFile(join(target, "atlas.config.ts"), "utf8"), /catalogUrl/);
  assert.match(await readFile(join(target, "package.json"), "utf8"), /atlas runtime-config customer-host/);
  const angularJson = JSON.parse(await readFile(join(target, "angular.json"), "utf8"));
  const architect = angularJson.projects["customer-host"].architect;
  assert.equal(architect.build.builder, "@angular-architects/native-federation:build");
  assert.equal(architect.build.options.target, "customer-host:esbuild:production");
  assert.deepEqual(architect.esbuild.options.polyfills, ["zone.js", "es-module-shims"]);
  assert.equal(architect.serve.builder, "@angular-architects/native-federation:build");
  assert.equal(architect.serve.options.target, "customer-host:serve-original:development");
  assert.equal(architect.serve.options.port, 4200);
  assert.match(main, /initFederation/);
  assert.match(bootstrap, /startHost/);
  assert.match(bootstrap, /AtlasHostDefaultRouteComponent/);
  assert.doesNotMatch(bootstrap, /AtlasDefaultHostRouteComponent/);
  assert.doesNotMatch(bootstrap, /localhost:4300/);
  assert.match(await readFile(join(target, "src/app/atlas-host-default-route.component.ts"), "utf8"), /standalone: true/);
});

test("atlas app generation only writes a route when a host is supplied", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "atlas-app-generator-"));
  const withoutHost = join(temporary, "orders");
  const withHost = join(temporary, "billing");

  await run(process.execPath, [
    "packages/cli/dist/index.js", "g", "app", "orders",
    "--framework=react", "--skip-install", `--directory=${withoutHost}`
  ]);
  await run(process.execPath, [
    "packages/cli/dist/index.js", "g", "app", "billing",
    "--framework=react", "--host=customer-host", "--skip-install", `--directory=${withHost}`
  ]);

  const defaultConfig = await readFile(join(withoutHost, "atlas.config.ts"), "utf8");
  assert.doesNotMatch(defaultConfig, /hostCompatibility/);
  assert.doesNotMatch(defaultConfig, /placements/);
  assert.doesNotMatch(defaultConfig, /mounts/);
  assert.doesNotMatch(defaultConfig, /routes/);
  assert.doesNotMatch(defaultConfig, /"host"/);

  const explicitConfig = await readFile(join(withHost, "atlas.config.ts"), "utf8");
  assert.doesNotMatch(explicitConfig, /hostCompatibility/);
  assert.match(explicitConfig, /routes: \[/);
  assert.match(explicitConfig, /hostId: "customer-host"/);
  assert.doesNotMatch(explicitConfig, /hostId: "host"/);
});

test("atlas runtime-config emits deployment runtime JSON from atlas.config.ts", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-runtime-config-"));
  const projectRoot = join(root, "host");
  const output = join(root, "runtime.json");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "acme", private: true, workspaces: ["host"] }));
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "host", version: "0.1.0", type: "module" }));
  await writeFile(join(projectRoot, "atlas.config.ts"), "export default {};\n");
  await mkdir(join(projectRoot, ".atlas"));
  await writeFile(join(projectRoot, ".atlas/atlas.config.js"), `export default {
    id: "host",
    framework: "react",
    allowAppOverrides: false,
    resourcesTimeoutMs: 12000,
    resourcesRetryCount: 4
  };\n`);

  await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "runtime-config", "host",
    "--skip-compile", "--registry-base-url=https://cdn.example/atlas", `--out=${output}`
  ], { cwd: root });

  const runtime = JSON.parse(await readFile(output, "utf8"));
  assert.equal(runtime.schemaVersion, "1");
  assert.equal(runtime.hostId, "host");
  assert.equal(runtime.catalogUrl, "https://cdn.example/atlas/hosts/host/catalog.json");
  assert.equal(runtime.allowAppOverrides, false);
  assert.equal(runtime.resourcesTimeoutMs, 12000);
  assert.equal(runtime.resourcesRetryCount, 4);
});

test("atlas compile-config emits atlas.config.js through the project tsconfig", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-compile-config-"));
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "orders", version: "0.1.0", type: "module" }));
  await writeFile(join(root, "tsconfig.json"), JSON.stringify({
    compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", strict: true, noEmit: true }
  }));
  await writeFile(join(root, "atlas.config.ts"), [
    "export default {",
    '  id: "orders",',
    '  framework: "react",',
    '  routes: [{ hostId: "customer-host", basePath: "/orders" }]',
    "};"
  ].join("\n"));

  await run(process.execPath, [join(process.cwd(), "packages/cli/dist/index.js"), "compile-config"], { cwd: root });

  await access(join(root, ".atlas", "atlas.config.js"));
});

test("atlas removes a newly generated project when dependency installation fails", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "atlas-generator-cleanup-"));
  const bin = join(temporary, "bin");
  const target = join(temporary, "customer-host");
  await mkdir(bin);
  await writeFile(join(temporary, "package-lock.json"), "{}\n");
  await writeFile(join(bin, "npm"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });

  await assert.rejects(run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "g", "host", "customer-host",
    "--framework=angular", "--skip-workspace-generator", `--directory=${target}`
  ], { cwd: temporary, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } }), /npm exited with code 1/);
  await assert.rejects(access(target), { code: "ENOENT" });
});

test("atlas generation registers projects with Nx automatically", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-generator-"));
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "acme", private: true, packageManager: "yarn@1.22.22" }));
  const stdout = await run(process.execPath, [join(process.cwd(), "packages/cli/dist/index.js"), "g", "app", "orders", "--framework=react", "--skip-install", "--skip-workspace-generator"], { cwd: root });
  const project = JSON.parse(await readFile(join(root, "orders/project.json"), "utf8"));
  assert.equal(project.name, "orders");
  assert.equal(project.targets.build.executor, "nx:run-commands");
  assert.equal(project.targets["atlas:config"].options.cwd, "orders");
  assert.deepEqual(project.targets["atlas:config"].outputs, ["{projectRoot}/.atlas"]);
  assert.equal(project.targets["atlas:config"].options.command, "yarn run atlas:config");
  assert.equal(project.targets.serve.options.cwd, "orders");
  assert.equal(project.targets.serve.options.command, "yarn run dev");
  assert.equal(project.targets.dev.options.command, "atlas dev orders");
  assert.equal(project.targets.dev.options.forwardAllArgs, true);
  assert.equal(project.targets.orders.options.command, "nx run orders:dev");
  assert.match(stdout, /Detected an Nx workspace/);
  assert.match(stdout, /Native Nx scaffolding was skipped; Atlas will generate the React scaffold directly at orders/);
});

for (const scenario of [
  {
    name: "Yarn workspace",
    prefix: "atlas-yarn-workspace-app-",
    files: { "package.json": JSON.stringify({ name: "acme", private: true, packageManager: "yarn@1.22.22", workspaces: ["packages/*"] }) },
    framework: "react",
    root: "packages/orders",
    entry: "src/entry.tsx",
    config: "vite.config.ts",
    match: /createRoutedApp/,
    configMatch: /remoteEntry\.json/
  },
  {
    name: "pnpm workspace",
    prefix: "atlas-pnpm-workspace-app-",
    files: {
      "package.json": JSON.stringify({ name: "acme", private: true, packageManager: "pnpm@10.0.0" }),
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n"
    },
    framework: "angular",
    root: "packages/orders",
    entry: "src/entry.ts",
    config: "federation.config.js",
    match: /defineApp/,
    configMatch: /"\.\/entry": "\.\/src\/entry\.ts"/
  },
  {
    name: "Turborepo",
    prefix: "atlas-turbo-app-",
    files: {
      "package.json": JSON.stringify({ name: "acme", private: true, packageManager: "pnpm@10.0.0", workspaces: ["apps/*"] }),
      "turbo.json": "{}\n"
    },
    framework: "react",
    root: "apps/orders",
    entry: "src/entry.tsx",
    config: "vite.config.ts",
    match: /createRoutedApp/,
    configMatch: /remoteEntry\.json/
  },
  {
    name: "Turborepo",
    prefix: "atlas-turbo-angular-app-",
    files: {
      "package.json": JSON.stringify({ name: "acme", private: true, packageManager: "pnpm@10.0.0", workspaces: ["apps/*"] }),
      "turbo.json": "{}\n"
    },
    framework: "angular",
    root: "apps/orders",
    entry: "src/entry.ts",
    config: "federation.config.js",
    match: /defineApp/,
    configMatch: /"\.\/entry": "\.\/src\/entry\.ts"/
  }
]) {
  test(`atlas generates complete app files in a ${scenario.name}`, async () => {
    const root = await mkdtemp(join(tmpdir(), scenario.prefix));
    for (const [path, contents] of Object.entries(scenario.files)) {
      await writeFile(join(root, path), contents);
    }

    const stdout = await run(process.execPath, [
      join(process.cwd(), "packages/cli/dist/index.js"), "g", "app", "orders",
      `--framework=${scenario.framework}`, "--skip-install"
    ], { cwd: root });

    const projectRoot = join(root, scenario.root);
    assert.match(await readFile(join(projectRoot, scenario.entry), "utf8"), scenario.match);
    assert.match(await readFile(join(projectRoot, scenario.config), "utf8"), scenario.configMatch);
    assert.match(await readFile(join(projectRoot, "atlas.config.ts"), "utf8"), new RegExp(`framework: "${scenario.framework}"`));
    assert.equal(JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8")).name, "orders");
    if (scenario.framework === "angular") {
      const angularJson = JSON.parse(await readFile(join(projectRoot, "angular.json"), "utf8"));
      const architect = angularJson.projects.orders.architect;
      assert.equal(architect.build.builder, "@angular-architects/native-federation:build");
      assert.equal(architect.build.options.target, "orders:esbuild:production");
      assert.deepEqual(architect.esbuild.options.polyfills, ["zone.js", "es-module-shims"]);
      assert.equal(architect.serve.builder, "@angular-architects/native-federation:build");
      assert.equal(architect.serve.options.target, "orders:serve-original:development");
      assert.equal(architect.serve.options.port, 4201);
    }
    assert.match(stdout, new RegExp(`Detected ${scenario.name === "Turborepo" ? "a Turborepo" : "a package-manager"} workspace`));
  });
}

for (const scenario of [
  {
    name: "Yarn workspace",
    prefix: "atlas-yarn-workspace-host-",
    files: { "package.json": JSON.stringify({ name: "acme", private: true, packageManager: "yarn@1.22.22", workspaces: ["packages/*"] }) },
    framework: "react",
    root: "packages/customer-host",
    dev: "atlas runtime-config customer-host && vite --host 0.0.0.0"
  },
  {
    name: "pnpm workspace",
    prefix: "atlas-pnpm-workspace-host-",
    files: {
      "package.json": JSON.stringify({ name: "acme", private: true, packageManager: "pnpm@10.0.0" }),
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n"
    },
    framework: "angular",
    root: "packages/customer-host",
    dev: "atlas runtime-config customer-host && ng serve customer-host"
  },
  {
    name: "Turborepo",
    prefix: "atlas-turbo-host-",
    files: {
      "package.json": JSON.stringify({ name: "acme", private: true, packageManager: "pnpm@10.0.0", workspaces: ["apps/*"] }),
      "turbo.json": "{}\n"
    },
    framework: "react",
    root: "apps/customer-host",
    dev: "atlas runtime-config customer-host && vite --host 0.0.0.0"
  }
]) {
  test(`atlas generates host workspace scripts in a ${scenario.name}`, async () => {
    const root = await mkdtemp(join(tmpdir(), scenario.prefix));
    for (const [path, contents] of Object.entries(scenario.files)) {
      await writeFile(join(root, path), contents);
    }

    await run(process.execPath, [
      join(process.cwd(), "packages/cli/dist/index.js"), "g", "host", "customer-host",
      `--framework=${scenario.framework}`, "--skip-install"
    ], { cwd: root });

    const packageJson = JSON.parse(await readFile(join(root, scenario.root, "package.json"), "utf8"));
    assert.equal(packageJson.scripts.dev, scenario.dev);
    assert.equal(packageJson.scripts["atlas:config"], "atlas compile-config customer-host");
    assert.ok(packageJson.scripts.build.includes("atlas runtime-config customer-host"));
    if (scenario.framework === "angular") {
      const appTsconfig = JSON.parse(await readFile(join(root, scenario.root, "tsconfig.app.json"), "utf8"));
      const angularJson = JSON.parse(await readFile(join(root, scenario.root, "angular.json"), "utf8"));
      const architect = angularJson.projects["customer-host"].architect;
      assert.equal(architect.build.builder, "@angular-architects/native-federation:build");
      assert.equal(architect.build.options.target, "customer-host:esbuild:production");
      assert.deepEqual(architect.esbuild.options.polyfills, ["zone.js", "es-module-shims"]);
      assert.equal(architect.serve.builder, "@angular-architects/native-federation:build");
      assert.equal(architect.serve.options.target, "customer-host:serve-original:development");
      assert.equal(architect.serve.options.port, 4200);
      assert.deepEqual(appTsconfig.files, ["src/main.ts"]);
      assert.equal(appTsconfig.extends, undefined);
      assert.equal(appTsconfig.compilerOptions.emitDeclarationOnly, undefined);
      await assert.rejects(access(join(root, scenario.root, "tsconfig.json")), { code: "ENOENT" });
      await assert.rejects(access(join(root, scenario.root, "tsconfig.atlas.json")), { code: "ENOENT" });
    }
  });
}

test("atlas preserves Nx Angular workspace version after native scaffolding", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-angular-generator-"));
  const bin = join(root, "bin");
  const products = join(root, "products");
  await mkdir(bin);
  await mkdir(products);
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({
    name: "acme",
    private: true,
    packageManager: "yarn@1.22.22",
    dependencies: { "@angular/core": "~20.3.0", "@angular/animations": "~21.2.0" },
    devDependencies: { "@nx/angular": "22.0.0" }
  }));
  await writeFile(join(root, "tsconfig.json"), JSON.stringify({ files: [], references: [] }));
  await writeFile(join(root, "tsconfig.base.json"), JSON.stringify({
    compilerOptions: { composite: true, declaration: true }
  }));
  await writeFile(join(bin, "yarn"), `#!/bin/sh
if [ "$1" = "nx" ] && [ "$2" = "format:write" ]; then
  printf '%s\n' "$3" > formatted.txt
  exit 0
fi
if [ "$1" = "nx" ] && [ "$2" = "generate" ]; then
  directory="$4"
  mkdir -p "$directory/public" "$directory/src"
  printf 'nx public asset\n' > "$directory/public/nx.txt"
  printf 'nx source\n' > "$directory/src/main.ts"
  printf 'nx eslint\n' > "$directory/eslint.config.mjs"
  printf 'nx jest\n' > "$directory/jest.config.ts"
  printf '{"name":"mobile-host","root":"products/host","marker":"nx-generator","targets":{"build":{"executor":"@nx/angular:application"},"serve":{"executor":"@angular-devkit/build-angular:dev-server","defaultConfiguration":"development","configurations":{"production":{"buildTarget":"mobile-host:build:production"},"development":{"buildTarget":"mobile-host:build:development"}}}}}\n' > "$directory/project.json"
  printf '{"extends":"../../tsconfig.base.json","marker":"nx-generator"}\n' > "$directory/tsconfig.json"
  printf '{"extends":"./tsconfig.json","marker":"nx-generator"}\n' > "$directory/tsconfig.app.json"
  exit 0
fi
exit 1
`, { mode: 0o755 });

  const stdout = await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "g", "host", "host",
    "--framework=angular", "--framework-version=~21.2.0", "--skip-install"
  ], { cwd: products, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });

  const project = JSON.parse(await readFile(join(root, "products/host/project.json"), "utf8"));
  assert.equal(project.marker, "nx-generator");
  assert.equal(project.targets["atlas:config"].options.cwd, undefined);
  assert.equal(project.targets["atlas:config"].options.command, "atlas compile-config mobile-host");
  assert.deepEqual(project.targets["atlas:config"].outputs, ["{projectRoot}/.atlas"]);
  assert.equal(project.targets.build.executor, "@angular-architects/native-federation:build");
  assert.equal(project.targets.build.options.target, "mobile-host:esbuild:production");
  assert.equal(project.targets.build.configurations.development.target, "mobile-host:esbuild:development");
  assert.equal(project.targets.build.configurations.development.dev, true);
  assert.equal(project.targets.esbuild.executor, "@nx/angular:application");
  assert.deepEqual(project.targets.esbuild.options.polyfills, ["es-module-shims"]);
  assert.equal(project.targets.serve.executor, "@angular-architects/native-federation:build");
  assert.equal(project.targets.serve.options.target, "mobile-host:serve-original:development");
  assert.equal(project.targets.serve.options.dev, true);
  assert.equal(project.targets.serve.options.port, 4200);
  assert.equal(project.targets["serve-original"].executor, "@angular-devkit/build-angular:dev-server");
  assert.equal(project.targets["serve-original"].configurations.production.buildTarget, "mobile-host:esbuild:production");
  assert.equal(project.targets["serve-original"].configurations.development.buildTarget, "mobile-host:esbuild:development");
  assert.equal(project.targets.dev.options.commands[0].command, "atlas runtime-config mobile-host");
  assert.equal(project.targets.dev.options.commands[1].command, "nx run mobile-host:serve");
  assert.equal(project.targets.dev.options.commands[1].forwardAllArgs, true);
  assert.equal(project.targets["mobile-host"].options.command, "nx run mobile-host:dev");
  assert.match(await readFile(join(root, "products/host/src/main.ts"), "utf8"), /import\("\.\/bootstrap"\)/);
  assert.match(await readFile(join(root, "products/host/src/bootstrap.ts"), "utf8"), /startHost/);
  assert.doesNotMatch(await readFile(join(root, "products/host/src/bootstrap.ts"), "utf8"), /AtlasDefaultHostRouteComponent/);
  await assert.rejects(access(join(root, "products/host/src/app.component.ts")), { code: "ENOENT" });
  assert.match(await readFile(join(root, "products/host/src/app/app.component.ts"), "utf8"), /data-atlas-host-status/);
  assert.match(await readFile(join(root, "products/host/src/app/atlas-host-default-route.component.ts"), "utf8"), /standalone: true/);
  assert.match(await readFile(join(root, "products/host/src/index.html"), "utf8"), /<atlas-host-root><\/atlas-host-root>/);
  assert.equal(await readFile(join(root, "products/host/eslint.config.mjs"), "utf8"), "nx eslint\n");
  assert.equal(await readFile(join(root, "products/host/jest.config.ts"), "utf8"), "nx jest\n");
  assert.equal(JSON.parse(await readFile(join(root, "products/host/tsconfig.json"), "utf8")).marker, "nx-generator");
  const angularHostTsconfig = JSON.parse(await readFile(join(root, "products/host/tsconfig.app.json"), "utf8"));
  assert.equal(angularHostTsconfig.marker, "nx-generator");
  assert.equal(angularHostTsconfig.include, undefined);
  assert.equal(angularHostTsconfig.compilerOptions.emitDeclarationOnly, false);
  assert.equal(await readFile(join(root, "products/host/public/nx.txt"), "utf8"), "nx public asset\n");
  await assert.rejects(access(join(root, "products/host/package.json")), { code: "ENOENT" });
  await assert.rejects(access(join(root, "products/host/angular.json")), { code: "ENOENT" });
  assert.match(await readFile(join(root, "products/host/atlas.config.ts"), "utf8"), /framework: "angular"/);
  assert.match(await readFile(join(root, "products/host/atlas.config.ts"), "utf8"), /resourcesRetryCount: 3/);
  assert.match(await readFile(join(root, "products/host/federation.config.js"), "utf8"), /Generated by Atlas/);
  assert.match(await readFile(join(root, "products/host/federation.config.js"), "utf8"), /Edit atlas\.config\.ts/);
  await assert.rejects(access(join(root, "products/host/public/atlas.runtime.json")), { code: "ENOENT" });
  const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  assert.equal(rootPackage.dependencies["@atlas/schema"], ATLAS_PACKAGE_RANGE);
  assert.equal(rootPackage.dependencies["@atlas/runtime"], ATLAS_PACKAGE_RANGE);
  assert.equal(rootPackage.dependencies["@atlas/sdk"], ATLAS_PACKAGE_RANGE);
  assert.equal(rootPackage.dependencies["@angular/core"], "~20.3.0");
  assert.equal(rootPackage.dependencies["@angular/animations"], "~20.3.0");
  assert.equal(rootPackage.dependencies["@angular-architects/native-federation"], "^20.0.0");
  assert.equal(rootPackage.dependencies["es-module-shims"], "^2.7.0");
  assert.equal(rootPackage.devDependencies["@nx/angular"], "22.0.0");
  assert.match(stdout, /Detected an Nx workspace/);
  assert.match(stdout, /Delegating Angular scaffolding to @nx\/angular:application at products\/host/);
  assert.match(stdout, /Detected existing Angular version ~20\.3\.0 in package\.json; ignoring --framework-version=~21\.2\.0/);
  assert.match(stdout, /Added Atlas dependencies to package\.json/);
  assert.equal(await readFile(join(root, "formatted.txt"), "utf8"), "products/host\n");
  assert.match(stdout, /Formatted generated files in products\/host/);
});

test("atlas preserves Nx React project scaffolding around host startup files", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-react-host-generator-"));
  const bin = join(root, "bin");
  await mkdir(bin);
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({
    name: "acme",
    private: true,
    packageManager: "yarn@1.22.22",
    dependencies: { react: "^19.2.0", "react-dom": "^19.2.0" },
    devDependencies: { "@nx/react": "22.0.0" }
  }));
  await writeFile(join(bin, "yarn"), `#!/bin/sh
if [ "$1" = "nx" ] && [ "$2" = "format:write" ]; then
  printf '%s\n' "$3" > formatted.txt
  exit 0
fi
if [ "$1" = "nx" ] && [ "$2" = "generate" ]; then
  directory="$4"
  mkdir -p "$directory/src" "$directory/public"
  printf 'nx react source\n' > "$directory/src/main.tsx"
  printf 'nx react css\n' > "$directory/src/styles.css"
  printf 'nx react index\n' > "$directory/index.html"
  printf 'nx react public asset\n' > "$directory/public/nx.txt"
  printf 'nx eslint\n' > "$directory/eslint.config.mjs"
  printf '{"name":"host","marker":"nx-generator"}\n' > "$directory/project.json"
  printf '{"extends":"../../tsconfig.base.json","marker":"nx-generator"}\n' > "$directory/tsconfig.json"
  exit 0
fi
exit 1
`, { mode: 0o755 });

  const stdout = await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "g", "host", "apps/host",
    "--framework=react", "--skip-install"
  ], { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });

  const project = JSON.parse(await readFile(join(root, "apps/host/project.json"), "utf8"));
  assert.equal(project.marker, "nx-generator");
  const hostMain = await readFile(join(root, "apps/host/src/main.tsx"), "utf8");
  assert.match(hostMain, /startHost/);
  assert.match(hostMain, /createBrowserRouter/);
  assert.doesNotMatch(hostMain, /import\.meta\.hot/);
  assert.match(await readFile(join(root, "apps/host/index.html"), "utf8"), /<script type="module" src="\/src\/main\.tsx"><\/script>/);
  assert.match(await readFile(join(root, "apps/host/src/styles.css"), "utf8"), /data-atlas-route-outlet/);
  assert.equal(await readFile(join(root, "apps/host/eslint.config.mjs"), "utf8"), "nx eslint\n");
  assert.equal(await readFile(join(root, "apps/host/public/nx.txt"), "utf8"), "nx react public asset\n");
  const reactHostTsconfig = JSON.parse(await readFile(join(root, "apps/host/tsconfig.json"), "utf8"));
  assert.equal(reactHostTsconfig.marker, "nx-generator");
  assert.deepEqual(reactHostTsconfig.include, ["atlas.config.ts"]);
  assert.match(await readFile(join(root, "apps/host/atlas.config.ts"), "utf8"), /framework: "react"/);
  await assert.rejects(access(join(root, "apps/host/package.json")), { code: "ENOENT" });
  const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  assert.equal(rootPackage.dependencies["@atlas/runtime"], ATLAS_PACKAGE_RANGE);
  assert.equal(rootPackage.dependencies.react, "^19.2.0");
  assert.equal(rootPackage.dependencies["react-dom"], "^19.2.0");
  assert.equal(rootPackage.devDependencies["@nx/react"], "22.0.0");
  assert.match(stdout, /Delegating React scaffolding to @nx\/react:application at apps\/host/);
  assert.match(stdout, /Added Atlas dependencies to package\.json/);
  assert.equal(await readFile(join(root, "formatted.txt"), "utf8"), "apps/host\n");
  assert.match(stdout, /Formatted generated files in apps\/host/);
});

test("atlas adds required Angular app files after Nx scaffolding", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-angular-app-generator-"));
  const bin = join(root, "bin");
  await mkdir(bin);
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({
    name: "acme",
    private: true,
    packageManager: "yarn@1.22.22",
    dependencies: { "@angular/core": "^20.3.0" },
    devDependencies: { "@nx/angular": "22.0.0" }
  }));
  await writeFile(join(bin, "yarn"), `#!/bin/sh
if [ "$1" = "nx" ] && [ "$2" = "format:write" ]; then
  printf '%s\n' "$3" > formatted.txt
  exit 0
fi
if [ "$1" = "nx" ] && [ "$2" = "generate" ]; then
  directory="$4"
  mkdir -p "$directory/src/app/nx-only" "$directory/public"
  printf 'nx angular source\n' > "$directory/src/main.ts"
  printf 'nx angular index\n' > "$directory/src/index.html"
  printf 'nx angular styles\n' > "$directory/src/styles.css"
  printf 'nx app component\n' > "$directory/src/app/app.component.ts"
  printf 'nx nested component\n' > "$directory/src/app/nx-only/nx-only.component.ts"
  printf 'nx angular public asset\n' > "$directory/public/nx.txt"
  printf 'nx eslint\n' > "$directory/eslint.config.mjs"
  printf '{"name":"orders","marker":"nx-generator","targets":{"build":{"executor":"@nx/angular:application"},"serve":{"executor":"@angular-devkit/build-angular:dev-server","defaultConfiguration":"development","configurations":{"production":{"buildTarget":"orders:build:production"},"development":{"buildTarget":"orders:build:development"}}}}}\n' > "$directory/project.json"
  printf '{"extends":"./tsconfig.json","marker":"nx-generator"}\n' > "$directory/tsconfig.app.json"
  exit 0
fi
exit 1
`, { mode: 0o755 });

  const stdout = await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "g", "app", "orders",
    "--framework=angular", "--skip-install"
  ], { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });

  assert.match(await readFile(join(root, "orders/src/entry.ts"), "utf8"), /defineApp/);
  assert.match(await readFile(join(root, "orders/src/entry.ts"), "utf8"), /bootstrapApplication\(AppComponent/);
  assert.doesNotMatch(await readFile(join(root, "orders/src/entry.ts"), "utf8"), /@Component|router-outlet/);
  await assert.rejects(access(join(root, "orders/src/app.component.ts")), { code: "ENOENT" });
  await assert.rejects(access(join(root, "orders/src/app/nx-only/nx-only.component.ts")), { code: "ENOENT" });
  assert.match(await readFile(join(root, "orders/src/app/README.md"), "utf8"), /Required Atlas wiring/);
  assert.match(await readFile(join(root, "orders/src/app/app.component.ts"), "utf8"), /router-outlet/);
  assert.match(await readFile(join(root, "orders/src/app/routes.ts"), "utf8"), /export const routes: Routes/);
  assert.match(await readFile(join(root, "orders/src/app/home/home.component.ts"), "utf8"), /export class HomeComponent/);
  assert.match(await readFile(join(root, "orders/src/app/details/details.component.ts"), "utf8"), /export class DetailsComponent/);
  assert.match(await readFile(join(root, "orders/src/main.ts"), "utf8"), /initFederation/);
  assert.match(await readFile(join(root, "orders/src/index.html"), "utf8"), /Atlas app assets/);
  const federationConfig = await readFile(join(root, "orders/federation.config.js"), "utf8");
  assert.match(federationConfig, /['"]\.\/entry['"]:\s*['"]\.\/orders\/src\/entry\.ts['"]/);
  assert.match(federationConfig, /`\.\/orders\/src\/exported-widgets\/\$\{entry\.name\}\/index\.ts`/);
  assert.match(await readFile(join(root, "orders/src/exported-widgets/README.md"), "utf8"), /Create `<widget-id>\/index\.ts`/);
  assert.equal(await readFile(join(root, "orders/public/nx.txt"), "utf8"), "nx angular public asset\n");
  assert.equal(await readFile(join(root, "orders/eslint.config.mjs"), "utf8"), "nx eslint\n");
  const project = JSON.parse(await readFile(join(root, "orders/project.json"), "utf8"));
  assert.equal(project.marker, "nx-generator");
  assert.equal(project.targets.build.executor, "@angular-architects/native-federation:build");
  assert.equal(project.targets.build.options.target, "orders:esbuild:production");
  assert.equal(project.targets.esbuild.executor, "@nx/angular:application");
  assert.deepEqual(project.targets.esbuild.options.polyfills, ["es-module-shims"]);
  assert.equal(project.targets.serve.executor, "@angular-architects/native-federation:build");
  assert.equal(project.targets.serve.options.target, "orders:serve-original:development");
  assert.equal(project.targets.serve.options.port, 4201);
  assert.equal(project.targets["serve-original"].executor, "@angular-devkit/build-angular:dev-server");
  assert.equal(project.targets["serve-original"].configurations.production.buildTarget, "orders:esbuild:production");
  assert.equal(project.targets["serve-original"].configurations.development.buildTarget, "orders:esbuild:development");
  assert.equal(project.targets.dev.options.command, "atlas dev orders");
  assert.equal(project.targets.dev.options.forwardAllArgs, true);
  assert.equal(project.targets.orders.options.command, "nx run orders:dev");
  const angularMfTsconfig = JSON.parse(await readFile(join(root, "orders/tsconfig.app.json"), "utf8"));
  assert.equal(angularMfTsconfig.marker, "nx-generator");
  assert.equal(angularMfTsconfig.include, undefined);
  assert.equal(angularMfTsconfig.compilerOptions.emitDeclarationOnly, false);
  assert.match(stdout, /Delegating Angular scaffolding to @nx\/angular:application at orders/);
  assert.equal(await readFile(join(root, "formatted.txt"), "utf8"), "orders\n");
  assert.match(stdout, /Formatted generated files in orders/);
});

test("atlas fails clearly when Nx Angular scaffolding reports stale project paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-angular-stale-root-"));
  const bin = join(root, "bin");
  await mkdir(bin);
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({
    name: "acme",
    private: true,
    packageManager: "yarn@1.22.22",
    dependencies: { "@angular/core": "^20.3.0" },
    devDependencies: { "@nx/angular": "22.0.0" }
  }));
  await writeFile(join(bin, "yarn"), `#!/bin/sh
if [ "$1" = "nx" ] && [ "$2" = "generate" ]; then
  directory="$4"
  mkdir -p "$directory/src"
  printf 'nx angular source\n' > "$directory/src/main.ts"
  printf '{"name":"orders","root":"login","sourceRoot":"login/src","targets":{"esbuild":{"options":{"browser":"login/src/main.ts","tsConfig":"login/tsconfig.app.json","styles":["login/src/styles.less"]}}}}\n' > "$directory/project.json"
  printf '{"extends":"./tsconfig.json"}\n' > "$directory/tsconfig.app.json"
  exit 0
fi
exit 1
`, { mode: 0o755 });

  await assert.rejects(run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "g", "app", "orders",
    "--framework=angular", "--skip-install"
  ], { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } }), {
    message: /Nx project root mismatch.*project\.json points at "login".*generated the project at "orders".*login\/tsconfig\.app\.json.*Update project\.json root\/sourceRoot\/build options/
  });
});

test("atlas adds required React app files after Nx scaffolding", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-react-app-generator-"));
  const bin = join(root, "bin");
  await mkdir(bin);
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({
    name: "acme",
    private: true,
    packageManager: "yarn@1.22.22",
    dependencies: { react: "^19.2.0", "react-dom": "^19.2.0" },
    devDependencies: { "@nx/react": "22.0.0" }
  }));
  await writeFile(join(bin, "yarn"), `#!/bin/sh
if [ "$1" = "nx" ] && [ "$2" = "format:write" ]; then
  printf '%s\n' "$3" > formatted.txt
  exit 0
fi
if [ "$1" = "nx" ] && [ "$2" = "generate" ]; then
  directory="$4"
  mkdir -p "$directory/src/app/nx-only" "$directory/public"
  printf 'nx react source\n' > "$directory/src/main.tsx"
  printf 'nx react index\n' > "$directory/index.html"
  printf 'nx react styles\n' > "$directory/src/styles.css"
  printf 'nx app component\n' > "$directory/src/app/app.tsx"
  printf 'nx nested component\n' > "$directory/src/app/nx-only/nx-only.tsx"
  printf 'nx react public asset\n' > "$directory/public/nx.txt"
  printf 'nx eslint\n' > "$directory/eslint.config.mjs"
  printf '{"name":"orders","marker":"nx-generator"}\n' > "$directory/project.json"
  printf '{"extends":"./tsconfig.json","marker":"nx-generator"}\n' > "$directory/tsconfig.app.json"
  exit 0
fi
exit 1
`, { mode: 0o755 });

  const stdout = await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "g", "app", "orders",
    "--framework=react", "--skip-install"
  ], { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });

  const reactEntry = await readFile(join(root, "orders/src/entry.tsx"), "utf8");
  assert.match(reactEntry, /createRoutedApp/);
  assert.match(reactEntry, /import \{ routes \} from "\.\/app\/routes"/);
  assert.doesNotMatch(reactEntry, /await import|import\.meta\.hot/);
  assert.doesNotMatch(reactEntry, /useAtlasSdk|<Outlet|<Link|function Layout/);
  assert.equal((await readdir(join(root, "orders/src/app"))).includes("app.tsx"), false);
  await assert.rejects(access(join(root, "orders/src/app/nx-only/nx-only.tsx")), { code: "ENOENT" });
  assert.match(await readFile(join(root, "orders/src/app/README.md"), "utf8"), /Main app component/);
  assert.match(await readFile(join(root, "orders/src/app/routes.tsx"), "utf8"), /export const routes: RouteObject\[\]/);
  assert.match(await readFile(join(root, "orders/src/app/App.tsx"), "utf8"), /useAtlasSdk/);
  assert.match(await readFile(join(root, "orders/src/app/home/Home.tsx"), "utf8"), /export function Home/);
  assert.match(await readFile(join(root, "orders/src/app/details/Details.tsx"), "utf8"), /export function Details/);
  const reactMain = await readFile(join(root, "orders/src/main.tsx"), "utf8");
  assert.match(reactMain, /createBrowserRouter\(routes\)/);
  assert.doesNotMatch(reactMain, /import\.meta\.hot/);
  const reactViteConfig = await readFile(join(root, "orders/vite.config.ts"), "utf8");
  assert.match(reactViteConfig, /remoteEntry\.json/);
  assert.match(reactViteConfig, /atlasReactRefreshPreamble/);
  assert.match(await readFile(join(root, "orders/index.html"), "utf8"), /Orders assets/);
  assert.match(await readFile(join(root, "orders/src/exported-widgets/README.md"), "utf8"), /Create `<widget-id>\/index\.tsx`/);
  assert.equal(await readFile(join(root, "orders/public/nx.txt"), "utf8"), "nx react public asset\n");
  assert.equal(await readFile(join(root, "orders/eslint.config.mjs"), "utf8"), "nx eslint\n");
  assert.equal(JSON.parse(await readFile(join(root, "orders/project.json"), "utf8")).marker, "nx-generator");
  const reactMfTsconfig = JSON.parse(await readFile(join(root, "orders/tsconfig.app.json"), "utf8"));
  assert.equal(reactMfTsconfig.marker, "nx-generator");
  assert.deepEqual(reactMfTsconfig.include, ["atlas.config.ts"]);
  assert.equal(reactMfTsconfig.compilerOptions.module, "ESNext");
  assert.equal(reactMfTsconfig.compilerOptions.moduleResolution, "bundler");
  assert.deepEqual(reactMfTsconfig.compilerOptions.types, ["vite/client"]);
  assert.match(stdout, /Delegating React scaffolding to @nx\/react:application at orders/);
  assert.equal(await readFile(join(root, "formatted.txt"), "utf8"), "orders\n");
  assert.match(stdout, /Formatted generated files in orders/);
});

test("atlas aligns React dependencies to an Nx project package framework version", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-package-generator-"));
  const bin = join(root, "bin");
  await mkdir(bin);
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({
    name: "acme",
    private: true,
    packageManager: "yarn@1.22.22",
    devDependencies: { "@nx/react": "22.0.0" }
  }));
  await writeFile(join(bin, "yarn"), `#!/bin/sh
if [ "$1" = "nx" ] && [ "$2" = "format:write" ]; then
  printf '%s\n' "$3" > formatted.txt
  exit 0
fi
if [ "$1" = "nx" ] && [ "$2" = "generate" ]; then
  directory="$4"
  mkdir -p "$directory/src"
  printf 'react source\n' > "$directory/src/main.tsx"
  printf '{"name":"@acme/orders","version":"0.0.1","dependencies":{"react":"^17.0.2","react-dom":"^18.3.1"},"devDependencies":{}}\n' > "$directory/package.json"
  printf '{"name":"orders","marker":"nx-generator"}\n' > "$directory/project.json"
  exit 0
fi
exit 1
`, { mode: 0o755 });

  const stdout = await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "g", "app", "packages/orders",
    "--framework=react", "--framework-version=^19.2.0", "--skip-install"
  ], { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });

  const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const projectPackage = JSON.parse(await readFile(join(root, "packages/orders/package.json"), "utf8"));
  assert.equal(rootPackage.dependencies?.["@atlas/sdk"], undefined);
  assert.equal(projectPackage.dependencies.react, "^17.0.2");
  assert.equal(projectPackage.dependencies["@atlas/schema"], ATLAS_PACKAGE_RANGE);
  assert.equal(projectPackage.dependencies["@atlas/sdk"], ATLAS_PACKAGE_RANGE);
  assert.equal(projectPackage.dependencies["@softarc/native-federation-runtime"], "^3.5.5");
  assert.equal(projectPackage.dependencies["react-dom"], "^17.0.2");
  assert.equal(projectPackage.dependencies["react-router-dom"], "^6.30.1");
  assert.equal(projectPackage.devDependencies["@vitejs/plugin-react"], "^5.0.4");
  assert.match(stdout, /Detected existing React version \^17\.0\.2 in packages\/orders\/package\.json; ignoring --framework-version=\^19\.2\.0/);
  assert.match(stdout, /Added Atlas dependencies to packages\/orders\/package\.json/);
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
  assert.match(stdout, /View app: https:\/\/host\.example\/orders/);
  assert.doesNotMatch(stdout, /atlas-override/);
});

test("atlas dev local catalog contains overridden manifests for fresh hosts", () => {
  const manifest = createTestManifest({
    id: "login",
    name: "Login",
    supportedHosts: ["mobile-host"],
    placements: [
      {
        id: "mobile-host-login-route",
        kind: "route",
        hostId: "mobile-host",
        route: { basePath: "/login" }
      }
    ]
  });
  const catalog = createLocalDevCatalog({
    schemaVersion: "1",
    hostId: "mobile-host",
    generatedAt: "2026-07-09T08:02:37.622Z",
    overrides: [{ mfId: "login", manifest, reason: "local" }]
  });

  assert.equal(catalog.schemaVersion, "1");
  assert.equal(catalog.hostId, "mobile-host");
  assert.equal(catalog.generatedAt, "2026-07-09T08:02:37.622Z");
  assert.deepEqual(catalog.manifests, [manifest]);
  const session = createDevSession({
    schemaVersion: "1",
    hostId: "mobile-host",
    generatedAt: "2026-07-09T08:02:37.622Z",
    overrides: [{ mfId: "login", manifest, reason: "local" }]
  }, catalog, "http://127.0.0.1:4400/atlas.local-overrides.json");
  assert.equal(session.hostId, "mobile-host");
  assert.equal(session.overrideUrl, "http://127.0.0.1:4400/atlas.local-overrides.json");
  assert.deepEqual(session.catalog, catalog);
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
  assert.match(stdout, /View app: https:\/\/host\.example\/dashboard/);
  assert.doesNotMatch(stdout, /atlas-override/);
});

test("atlas dev waits for valid remote federation metadata", async () => {
  assert.equal(await remoteEntryIsReady(new Response("<!DOCTYPE html>", {
    status: 200,
    headers: { "content-type": "text/html" }
  })), false);
  assert.equal(await remoteEntryIsReady(new Response("not found", {
    status: 404,
    headers: { "content-type": "application/json" }
  })), false);
  assert.equal(await remoteEntryIsReady(new Response(JSON.stringify({ name: "atlas_orders", exposes: [] }), {
    status: 200,
    headers: { "content-type": "application/json" }
  })), true);
});

test("atlas dev delegates host projects to the workspace dev task", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-host-"));
  const projectRoot = join(root, "customer-host");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "customer-host", version: "1.0.0", type: "module" }));
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", strict: true } }));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "customer-host",',
    '  framework: "react",',
    "  allowAppOverrides: true",
    "};"
  ].join("\n"));

  const calls = [];
  const project = { id: "customer-host", root: projectRoot, packageName: "customer-host", version: "1.0.0", outputPaths: [] };
  const workspace = {
    kind: "standalone",
    root,
    packageManager: "npm",
    findProject: async () => project,
    run: async (_project, task) => calls.push(["run", task]),
    spawn: (_project, task) => {
      calls.push(["spawn", task]);
      const child = new EventEmitter();
      child.killed = false;
      child.kill = () => {
        child.killed = true;
        child.emit("exit", null, "SIGTERM");
        return true;
      };
      setImmediate(() => child.emit("exit", 0, null));
      return child;
    }
  };
  const args = new CliArguments(["dev", "customer-host"]);
  const originalInfo = console.info;

  try {
    console.info = () => {};
    await new AtlasDevService(workspace, args, new AtlasBuildService(workspace, args)).run("customer-host");
  } finally {
    console.info = originalInfo;
  }

  assert.deepEqual(calls, [["spawn", "dev"]]);
});

test("atlas dev delegates Nx app projects to the serve task", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-nx-app-"));
  const projectRoot = join(root, "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "orders", version: "1.0.0", type: "module" }));
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify({
    compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", strict: true }
  }));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "orders",',
    '  name: "Orders",',
    '  framework: "react",',
    '  routes: [{ hostId: "customer-host", basePath: "/orders", title: "Orders" }]',
    "};"
  ].join("\n"));

  const remoteServer = await listenWithRemoteEntry();
  const controlPort = await availablePort();
  const calls = [];
  const project = { id: "orders", root: projectRoot, packageName: "orders", version: "1.0.0", outputPaths: [] };
  const workspace = {
    kind: "nx",
    root,
    packageManager: "npm",
    findProject: async (name) => name === "customer-host"
      ? Promise.reject(new Error("host not present"))
      : project,
    run: async (_project, task) => calls.push(["run", task]),
    spawn: (_project, task, args) => {
      calls.push(["spawn", task, args]);
      const child = new EventEmitter();
      child.killed = false;
      child.exitCode = null;
      child.signalCode = null;
      child.kill = () => {
        child.killed = true;
        child.signalCode = "SIGTERM";
        child.emit("exit", null, "SIGTERM");
        return true;
      };
      setTimeout(() => {
        if (child.killed) return;
        child.exitCode = 0;
        child.emit("exit", 0, null);
      }, 50);
      return child;
    }
  };
  const args = new CliArguments([
    "dev", "orders",
    "--host=customer-host",
    "--host-url=https://host.example/orders",
    `--port=${remoteServer.port}`,
    `--control-port=${controlPort}`,
    "--no-open"
  ]);
  const builds = {
    loadConfig: async () => ({
      id: "orders",
      name: "Orders",
      framework: "react",
      routes: [{ hostId: "customer-host", basePath: "/orders", title: "Orders" }]
    }),
    buildManifest: async () => ({
      id: "orders",
      name: "Orders",
      framework: "react",
      channel: "local",
      version: "1.0.0",
      buildId: "local",
      remoteEntryUrl: `http://127.0.0.1:${remoteServer.port}/remoteEntry.json`,
      placements: [],
      exportedWidgets: [],
      styles: []
    })
  };
  const originalInfo = console.info;

  try {
    console.info = () => {};
    await new AtlasDevService(workspace, args, builds).run("orders");
  } finally {
    console.info = originalInfo;
    await closeServer(remoteServer.server);
  }

  assert.deepEqual(calls, [["spawn", "serve", ["--port", String(remoteServer.port)]]]);
});

test("atlas dev rejects corrupt Angular build tooling before spawning", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-angular-build-preflight-"));
  const projectRoot = join(root, "mobile-host");
  const angularBuildRoot = join(root, "node_modules", "@angular", "build");
  await mkdir(join(angularBuildRoot, "src/tools/angular/compilation"), { recursive: true });
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(angularBuildRoot, "package.json"), JSON.stringify({ name: "@angular/build", version: "21.2.18" }));
  await writeFile(
    join(angularBuildRoot, "src/tools/angular/compilation/angular-compilation.js"),
    "const { readConfiguration } = require('@angular/compiler-cli'); creadConfiguration('tsconfig.json');\n"
  );
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "mobile-host", version: "0.1.0", type: "module" }));
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify({
    compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", strict: true }
  }));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "mobile-host",',
    '  framework: "angular",',
    "  allowAppOverrides: true",
    "};"
  ].join("\n"));

  const project = { id: "mobile-host", root: projectRoot, packageName: "mobile-host", version: "0.1.0", outputPaths: [] };
  const workspace = {
    kind: "standalone",
    root,
    packageManager: "npm",
    findProject: async () => project,
    run: async () => {},
    spawn: () => {
      throw new Error("corrupt Angular build preflight should stop before spawn");
    }
  };
  const args = new CliArguments(["dev", "mobile-host"]);

  await assert.rejects(
    new AtlasDevService(workspace, args, new AtlasBuildService(workspace, args)).run("mobile-host"),
    /@angular\/build 21\.2\.18 is corrupt.*creadConfiguration/
  );
});

test("atlas dev compiles atlas.config.ts with the project tsconfig", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-config-compile-"));
  const projectRoot = join(root, "mobile-host");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "mobile-host", version: "0.1.0", type: "module" }));
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify({
    compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", strict: true, noEmit: true }
  }));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "mobile-host",',
    '  framework: "react",',
    "  allowAppOverrides: true",
    "};"
  ].join("\n"));

  const calls = [];
  const project = { id: "mobile-host", root: projectRoot, packageName: "mobile-host", version: "0.1.0", outputPaths: [] };
  const workspace = {
    kind: "standalone",
    root,
    packageManager: "npm",
    findProject: async () => project,
    run: async (_project, task) => calls.push(["run", task]),
    spawn: () => {
      throw new Error("prepare-only should not spawn");
    }
  };
  const args = new CliArguments(["dev", "mobile-host", "--prepare-only"]);
  const originalInfo = console.info;

  try {
    console.info = () => {};
    await new AtlasDevService(workspace, args, new AtlasBuildService(workspace, args)).run("mobile-host");
  } finally {
    console.info = originalInfo;
  }

  await access(join(projectRoot, ".atlas", "atlas.config.js"));
  assert.deepEqual(calls, []);
});

test("atlas dev prefers tsconfig.app.json for atlas.config.ts compilation", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-app-tsconfig-"));
  const projectRoot = join(root, "apps", "mobile-host");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "mobile-host", version: "0.1.0", type: "module" }));
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify({ compilerOptions: { emitDeclarationOnly: true } }));
  await writeFile(join(projectRoot, "tsconfig.app.json"), JSON.stringify({
    compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", strict: true }
  }));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "mobile-host",',
    '  framework: "react",',
    "  allowAppOverrides: true",
    "};"
  ].join("\n"));

  const calls = [];
  const project = { id: "mobile-host", root: projectRoot, packageName: "mobile-host", version: "0.1.0", outputPaths: [] };
  const workspace = {
    kind: "nx",
    root,
    packageManager: "npm",
    findProject: async () => project,
    run: async (_project, task) => { calls.push(["run", task]); },
    spawn: () => {
      throw new Error("prepare-only should not spawn");
    }
  };
  const args = new CliArguments(["dev", "mobile-host", "--prepare-only"]);
  const originalInfo = console.info;

  try {
    console.info = () => {};
    await new AtlasDevService(workspace, args, new AtlasBuildService(workspace, args)).run("mobile-host");
  } finally {
    console.info = originalInfo;
  }

  await access(join(projectRoot, ".atlas", "atlas.config.js"));
  assert.deepEqual(calls, []);
});

test("atlas dev without a project uses the current Atlas project directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-current-project-"));
  const projectRoot = join(root, "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({
    name: "orders",
    version: "1.0.0",
    type: "module"
  }));
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", strict: true } }));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "orders",',
    '  framework: "react",',
    '  routes: [{ hostId: "customer-host", basePath: "/orders" }]',
    "};"
  ].join("\n"));

  const stdout = await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"),
    "dev",
    "--prepare-only",
    "--control-port=4521"
  ], { cwd: projectRoot, env: { ...process.env, ATLAS_HOST_ORIGIN: "http://localhost:5173" } });

  const document = JSON.parse(await readFile(join(projectRoot, ".atlas/local-overrides.json"), "utf8"));
  assert.equal(document.hostId, "customer-host");
  assert.match(stdout, /Starting \./);
  assert.match(stdout, /View app: http:\/\/localhost:5173\/orders/);
  assert.doesNotMatch(stdout, /atlas-override/);
});

test("workspace .env supplies Atlas dev defaults without overriding shell env", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-env-"));
  const originalHost = process.env.ATLAS_HOST;
  const originalHostOrigin = process.env.ATLAS_HOST_ORIGIN;
  process.env.ATLAS_HOST = "shell-host";
  delete process.env.ATLAS_HOST_ORIGIN;
  await writeFile(join(root, ".env"), [
    "ATLAS_HOST=file-host",
    "ATLAS_HOST_ORIGIN=http://localhost:4200",
    "# ignored"
  ].join("\n"));

  try {
    await loadWorkspaceEnv(root);
    assert.equal(process.env.ATLAS_HOST, "shell-host");
    assert.equal(process.env.ATLAS_HOST_ORIGIN, "http://localhost:4200");
  } finally {
    restoreEnv("ATLAS_HOST", originalHost);
    restoreEnv("ATLAS_HOST_ORIGIN", originalHostOrigin);
  }
});

test("atlas dev infers a single configured host and builds host URL from env origin", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-single-host-"));
  const projectRoot = join(root, "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", strict: true } }));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "orders",',
    '  framework: "react",',
    '  routes: [{ hostId: "customer-host", basePath: "/orders" }]',
    "};"
  ].join("\n"));
  const originalHost = process.env.ATLAS_HOST;
  const originalHostUrl = process.env.ATLAS_HOST_URL;
  const originalHostOrigin = process.env.ATLAS_HOST_ORIGIN;
  delete process.env.ATLAS_HOST;
  delete process.env.ATLAS_HOST_URL;
  process.env.ATLAS_HOST_ORIGIN = "http://localhost:5173";

  try {
    const stdout = await runDevService(root, projectRoot, ["dev", "orders", "--control-port=4520", "--prepare-only"]);
    const document = JSON.parse(await readFile(join(projectRoot, ".atlas/local-overrides.json"), "utf8"));
    assert.equal(document.hostId, "customer-host");
    assert.match(stdout, /http:\/\/localhost:5173\/orders/);
    assert.doesNotMatch(stdout, /atlas-override/);
  } finally {
    restoreEnv("ATLAS_HOST", originalHost);
    restoreEnv("ATLAS_HOST_URL", originalHostUrl);
    restoreEnv("ATLAS_HOST_ORIGIN", originalHostOrigin);
  }
});

test("atlas dev prompts when multiple configured hosts are possible", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-multi-host-"));
  const projectRoot = join(root, "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", strict: true } }));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "orders",',
    '  framework: "angular",',
    '  routes: [',
    '    { hostId: "customer-host", basePath: "/orders" },',
    '    { hostId: "admin-host", basePath: "/admin/orders" }',
    "  ]",
    "};"
  ].join("\n"));
  const originalHost = process.env.ATLAS_HOST;
  const originalHostUrl = process.env.ATLAS_HOST_URL;
  const originalHostOrigin = process.env.ATLAS_HOST_ORIGIN;
  delete process.env.ATLAS_HOST;
  delete process.env.ATLAS_HOST_URL;
  delete process.env.ATLAS_HOST_ORIGIN;

  try {
    await runDevService(root, projectRoot, ["dev", "orders", "--host-url=https://admin.example/admin/orders", "--prepare-only"], {
      interactive: true,
      select: async (_message, choices) => choices.find((choice) => choice.value === "admin-host").value
    });

    const document = JSON.parse(await readFile(join(projectRoot, ".atlas/local-overrides.json"), "utf8"));
    assert.equal(document.hostId, "admin-host");
  } finally {
    restoreEnv("ATLAS_HOST", originalHost);
    restoreEnv("ATLAS_HOST_URL", originalHostUrl);
    restoreEnv("ATLAS_HOST_ORIGIN", originalHostOrigin);
  }
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

async function runDevService(root, projectRoot, values, prompts) {
  const project = { id: "orders", root: projectRoot, packageName: "orders", version: "1.0.0", outputPaths: [] };
  const workspace = {
    kind: "standalone",
    root,
    packageManager: "npm",
    findProject: async () => project,
    run: async () => {},
    spawn: () => {
      throw new Error("prepare-only test must not spawn a dev server");
    }
  };
  const args = new CliArguments(values);
  const originalInfo = console.info;
  let stdout = "";
  try {
    console.info = (message = "") => { stdout += `${message}\n`; };
    await new AtlasDevService(workspace, args, new AtlasBuildService(workspace, args)).run("orders", prompts);
    return stdout;
  } finally {
    console.info = originalInfo;
  }
}

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function listenWithRemoteEntry() {
  const server = createServer((request, response) => {
    if (request.url === "/remoteEntry.json") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"name":"atlas_orders","exposes":[]}\n');
      return;
    }
    response.writeHead(404);
    response.end("Not found\n");
  });
  return listenOnRandomPort(server);
}

async function availablePort() {
  const { server, port } = await listenOnRandomPort(createServer());
  await closeServer(server);
  return port;
}

function listenOnRandomPort(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a local port."));
        return;
      }
      resolve({ server, port: address.port });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function assertSingleComponentDeclaration(path, contents) {
  const componentCount = angularComponentCount(contents) + reactComponentCount(contents);
  assert.ok(componentCount <= 1, `${path} contains ${componentCount} component declarations`);
}

function angularComponentCount(contents) {
  return [...contents.matchAll(/@Component\s*\(/g)].length;
}

function reactComponentCount(contents) {
  return [...contents.matchAll(/\bfunction\s+[A-Z][A-Za-z0-9_]*\s*\(/g)].length;
}
