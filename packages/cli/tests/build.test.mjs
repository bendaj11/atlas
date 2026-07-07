import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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
  await run(process.execPath, ["packages/cli/dist/index.js", "g", "host", "customer-shell", "--framework=angular", "--skip-install", `--directory=${target}`]);
  const main = await readFile(join(target, "src/main.ts"), "utf8");
  const bootstrap = await readFile(join(target, "src/bootstrap.ts"), "utf8");
  await assert.rejects(access(join(target, "public/atlas.runtime.json")), { code: "ENOENT" });
  assert.match(await readFile(join(target, "atlas.config.ts"), "utf8"), /runtime:/);
  assert.match(await readFile(join(target, "package.json"), "utf8"), /atlas runtime-config customer-shell/);
  assert.match(main, /initFederation/);
  assert.match(bootstrap, /startHost/);
  assert.doesNotMatch(bootstrap, /localhost:4300/);
});

test("atlas app generation only writes host compatibility when a host is supplied", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "atlas-app-generator-"));
  const withoutHost = join(temporary, "orders");
  const withHost = join(temporary, "billing");

  await run(process.execPath, [
    "packages/cli/dist/index.js", "g", "app", "orders",
    "--framework=react", "--skip-install", `--directory=${withoutHost}`
  ]);
  await run(process.execPath, [
    "packages/cli/dist/index.js", "g", "app", "billing",
    "--framework=react", "--host=customer-shell", "--skip-install", `--directory=${withHost}`
  ]);

  const defaultConfig = await readFile(join(withoutHost, "atlas.config.ts"), "utf8");
  assert.doesNotMatch(defaultConfig, /hostCompatibility/);
  assert.doesNotMatch(defaultConfig, /placements/);
  assert.doesNotMatch(defaultConfig, /"shell"/);

  const explicitConfig = await readFile(join(withHost, "atlas.config.ts"), "utf8");
  assert.match(explicitConfig, /hostCompatibility: \["customer-shell"\]/);
  assert.match(explicitConfig, /hostId: "customer-shell"/);
  assert.doesNotMatch(explicitConfig, /hostId: "shell"/);
});

test("atlas runtime-config emits deployment runtime JSON from atlas.config.ts", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-runtime-config-"));
  const projectRoot = join(root, "shell");
  const output = join(root, "runtime.json");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "acme", private: true, workspaces: ["shell"] }));
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "shell", version: "0.1.0", type: "module" }));
  await writeFile(join(projectRoot, "atlas.config.ts"), "export default {};\n");
  await mkdir(join(projectRoot, ".atlas"));
  await writeFile(join(projectRoot, ".atlas/atlas.config.js"), `export default {
    id: "shell",
    framework: "react",
    runtime: {
      catalogUrl: "https://cdn.example/atlas/hosts/shell/catalog.json",
      allowedRemoteOrigins: ["https://assets.example"],
      retryAttempts: 4,
      loadingIndicator: "none"
    }
  };\n`);

  await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "runtime-config", "shell",
    "--skip-compile", `--out=${output}`
  ], { cwd: root });

  const runtime = JSON.parse(await readFile(output, "utf8"));
  assert.equal(runtime.schemaVersion, "1");
  assert.equal(runtime.hostId, "shell");
  assert.equal(runtime.catalogUrl, "https://cdn.example/atlas/hosts/shell/catalog.json");
  assert.deepEqual(runtime.allowedRemoteOrigins, ["https://assets.example"]);
  assert.equal(runtime.retryAttempts, 4);
  assert.equal(runtime.loadingIndicator, "none");
  assert.equal(runtime.waitForMfReady, true);
});

test("atlas removes a newly generated project when dependency installation fails", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "atlas-generator-cleanup-"));
  const bin = join(temporary, "bin");
  const target = join(temporary, "customer-shell");
  await mkdir(bin);
  await writeFile(join(temporary, "package-lock.json"), "{}\n");
  await writeFile(join(bin, "npm"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });

  await assert.rejects(run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "g", "host", "customer-shell",
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
  assert.match(stdout, /Detected an Nx workspace/);
  assert.match(stdout, /Native Nx scaffolding was skipped; Atlas will generate the React scaffold directly at orders/);
});

for (const scenario of [
  {
    name: "Yarn workspace",
    prefix: "atlas-yarn-workspace-mf-",
    files: { "package.json": JSON.stringify({ name: "acme", private: true, packageManager: "yarn@1.22.22", workspaces: ["packages/*"] }) },
    framework: "react",
    root: "packages/orders",
    entry: "src/entry.tsx",
    config: "vite.config.ts",
    match: /createRoutedMicrofrontend/,
    configMatch: /remoteEntry\.json/
  },
  {
    name: "pnpm workspace",
    prefix: "atlas-pnpm-workspace-mf-",
    files: {
      "package.json": JSON.stringify({ name: "acme", private: true, packageManager: "pnpm@10.0.0" }),
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n"
    },
    framework: "angular",
    root: "packages/orders",
    entry: "src/entry.ts",
    config: "federation.config.js",
    match: /defineMicrofrontend/,
    configMatch: /"\.\/entry": "\.\/src\/entry\.ts"/
  },
  {
    name: "Turborepo",
    prefix: "atlas-turbo-mf-",
    files: {
      "package.json": JSON.stringify({ name: "acme", private: true, packageManager: "pnpm@10.0.0", workspaces: ["apps/*"] }),
      "turbo.json": "{}\n"
    },
    framework: "react",
    root: "apps/orders",
    entry: "src/entry.tsx",
    config: "vite.config.ts",
    match: /createRoutedMicrofrontend/,
    configMatch: /remoteEntry\.json/
  }
]) {
  test(`atlas generates complete MF files in a ${scenario.name}`, async () => {
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
    assert.match(stdout, new RegExp(`Detected ${scenario.name === "Turborepo" ? "a Turborepo" : "a package-manager"} workspace`));
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
if [ "$1" = "nx" ] && [ "$2" = "generate" ]; then
  directory="$4"
  mkdir -p "$directory/public" "$directory/src"
  printf 'nx public asset\n' > "$directory/public/nx.txt"
  printf 'nx source\n' > "$directory/src/main.ts"
  printf 'nx eslint\n' > "$directory/eslint.config.mjs"
  printf 'nx jest\n' > "$directory/jest.config.ts"
  printf '{"name":"shell","marker":"nx-generator"}\n' > "$directory/project.json"
  printf '{"extends":"../../tsconfig.base.json","marker":"nx-generator"}\n' > "$directory/tsconfig.json"
  printf '{"extends":"./tsconfig.json","marker":"nx-generator"}\n' > "$directory/tsconfig.app.json"
  exit 0
fi
exit 1
`, { mode: 0o755 });

  const stdout = await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "g", "host", "shell",
    "--framework=angular", "--framework-version=~21.2.0", "--skip-install"
  ], { cwd: products, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });

  const project = JSON.parse(await readFile(join(root, "products/shell/project.json"), "utf8"));
  assert.equal(project.marker, "nx-generator");
  assert.match(await readFile(join(root, "products/shell/src/main.ts"), "utf8"), /import\("\.\/bootstrap"\)/);
  assert.match(await readFile(join(root, "products/shell/src/bootstrap.ts"), "utf8"), /startHost/);
  assert.match(await readFile(join(root, "products/shell/src/app.component.ts"), "utf8"), /data-atlas-host-status/);
  assert.match(await readFile(join(root, "products/shell/src/index.html"), "utf8"), /<atlas-host-root><\/atlas-host-root>/);
  assert.equal(await readFile(join(root, "products/shell/eslint.config.mjs"), "utf8"), "nx eslint\n");
  assert.equal(await readFile(join(root, "products/shell/jest.config.ts"), "utf8"), "nx jest\n");
  assert.equal(JSON.parse(await readFile(join(root, "products/shell/tsconfig.json"), "utf8")).marker, "nx-generator");
  assert.equal(JSON.parse(await readFile(join(root, "products/shell/tsconfig.app.json"), "utf8")).marker, "nx-generator");
  assert.equal(await readFile(join(root, "products/shell/public/nx.txt"), "utf8"), "nx public asset\n");
  await assert.rejects(access(join(root, "products/shell/package.json")), { code: "ENOENT" });
  await assert.rejects(access(join(root, "products/shell/angular.json")), { code: "ENOENT" });
  assert.match(await readFile(join(root, "products/shell/atlas.config.ts"), "utf8"), /framework: "angular"/);
  assert.match(await readFile(join(root, "products/shell/atlas.config.ts"), "utf8"), /runtime:/);
  assert.match(await readFile(join(root, "products/shell/federation.config.js"), "utf8"), /Generated by Atlas/);
  assert.match(await readFile(join(root, "products/shell/federation.config.js"), "utf8"), /Edit atlas\.config\.ts/);
  await assert.rejects(access(join(root, "products/shell/public/atlas.runtime.json")), { code: "ENOENT" });
  const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  assert.equal(rootPackage.dependencies["@atlas/contracts"], "^0.2.17");
  assert.equal(rootPackage.dependencies["@atlas/runtime"], "^0.2.17");
  assert.equal(rootPackage.dependencies["@atlas/sdk"], "^0.2.17");
  assert.equal(rootPackage.dependencies["@angular/core"], "~20.3.0");
  assert.equal(rootPackage.dependencies["@angular/animations"], "~20.3.0");
  assert.equal(rootPackage.dependencies["@angular-architects/native-federation"], "^20.0.0");
  assert.equal(rootPackage.dependencies["es-module-shims"], "^2.7.0");
  assert.equal(rootPackage.devDependencies["@nx/angular"], "22.0.0");
  assert.match(stdout, /Detected an Nx workspace/);
  assert.match(stdout, /Delegating Angular scaffolding to @nx\/angular:application at products\/shell/);
  assert.match(stdout, /Detected existing Angular version ~20\.3\.0 in package\.json; ignoring --framework-version=~21\.2\.0/);
  assert.match(stdout, /Added Atlas dependencies to package\.json/);
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
if [ "$1" = "nx" ] && [ "$2" = "generate" ]; then
  directory="$4"
  mkdir -p "$directory/src" "$directory/public"
  printf 'nx react source\n' > "$directory/src/main.tsx"
  printf 'nx react css\n' > "$directory/src/styles.css"
  printf 'nx react index\n' > "$directory/index.html"
  printf 'nx react public asset\n' > "$directory/public/nx.txt"
  printf 'nx eslint\n' > "$directory/eslint.config.mjs"
  printf '{"name":"shell","marker":"nx-generator"}\n' > "$directory/project.json"
  printf '{"extends":"../../tsconfig.base.json","marker":"nx-generator"}\n' > "$directory/tsconfig.json"
  exit 0
fi
exit 1
`, { mode: 0o755 });

  const stdout = await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "g", "host", "apps/shell",
    "--framework=react", "--skip-install"
  ], { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });

  const project = JSON.parse(await readFile(join(root, "apps/shell/project.json"), "utf8"));
  assert.equal(project.marker, "nx-generator");
  assert.match(await readFile(join(root, "apps/shell/src/main.tsx"), "utf8"), /startHost/);
  assert.match(await readFile(join(root, "apps/shell/src/main.tsx"), "utf8"), /createBrowserRouter/);
  assert.match(await readFile(join(root, "apps/shell/index.html"), "utf8"), /<script type="module" src="\/src\/main\.tsx"><\/script>/);
  assert.match(await readFile(join(root, "apps/shell/src/styles.css"), "utf8"), /data-atlas-route-outlet/);
  assert.equal(await readFile(join(root, "apps/shell/eslint.config.mjs"), "utf8"), "nx eslint\n");
  assert.equal(await readFile(join(root, "apps/shell/public/nx.txt"), "utf8"), "nx react public asset\n");
  assert.equal(JSON.parse(await readFile(join(root, "apps/shell/tsconfig.json"), "utf8")).marker, "nx-generator");
  assert.match(await readFile(join(root, "apps/shell/atlas.config.ts"), "utf8"), /framework: "react"/);
  await assert.rejects(access(join(root, "apps/shell/package.json")), { code: "ENOENT" });
  const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  assert.equal(rootPackage.dependencies["@atlas/runtime"], "^0.2.17");
  assert.equal(rootPackage.dependencies.react, "^19.2.0");
  assert.equal(rootPackage.dependencies["react-dom"], "^19.2.0");
  assert.equal(rootPackage.devDependencies["@nx/react"], "22.0.0");
  assert.match(stdout, /Delegating React scaffolding to @nx\/react:application at apps\/shell/);
  assert.match(stdout, /Added Atlas dependencies to package\.json/);
});

test("atlas adds required Angular MF files after Nx scaffolding", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-angular-mf-generator-"));
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
  mkdir -p "$directory/src" "$directory/public"
  printf 'nx angular source\n' > "$directory/src/main.ts"
  printf 'nx angular index\n' > "$directory/src/index.html"
  printf 'nx angular styles\n' > "$directory/src/styles.css"
  printf 'nx angular public asset\n' > "$directory/public/nx.txt"
  printf 'nx eslint\n' > "$directory/eslint.config.mjs"
  printf '{"name":"orders","marker":"nx-generator"}\n' > "$directory/project.json"
  exit 0
fi
exit 1
`, { mode: 0o755 });

  const stdout = await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "g", "app", "orders",
    "--framework=angular", "--skip-install"
  ], { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });

  assert.match(await readFile(join(root, "orders/src/entry.ts"), "utf8"), /defineMicrofrontend/);
  assert.match(await readFile(join(root, "orders/src/main.ts"), "utf8"), /initFederation/);
  assert.match(await readFile(join(root, "orders/src/index.html"), "utf8"), /Atlas microfrontend assets/);
  assert.match(await readFile(join(root, "orders/federation.config.js"), "utf8"), /"\.\/entry": "\.\/src\/entry\.ts"/);
  assert.match(await readFile(join(root, "orders/src/exported-components/README.md"), "utf8"), /Create `<widget-id>\/index\.ts`/);
  assert.equal(await readFile(join(root, "orders/public/nx.txt"), "utf8"), "nx angular public asset\n");
  assert.equal(await readFile(join(root, "orders/eslint.config.mjs"), "utf8"), "nx eslint\n");
  assert.equal(JSON.parse(await readFile(join(root, "orders/project.json"), "utf8")).marker, "nx-generator");
  assert.match(stdout, /Delegating Angular scaffolding to @nx\/angular:application at orders/);
});

test("atlas adds required React MF files after Nx scaffolding", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-react-mf-generator-"));
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
if [ "$1" = "nx" ] && [ "$2" = "generate" ]; then
  directory="$4"
  mkdir -p "$directory/src" "$directory/public"
  printf 'nx react source\n' > "$directory/src/main.tsx"
  printf 'nx react index\n' > "$directory/index.html"
  printf 'nx react styles\n' > "$directory/src/styles.css"
  printf 'nx react public asset\n' > "$directory/public/nx.txt"
  printf 'nx eslint\n' > "$directory/eslint.config.mjs"
  printf '{"name":"orders","marker":"nx-generator"}\n' > "$directory/project.json"
  exit 0
fi
exit 1
`, { mode: 0o755 });

  const stdout = await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "g", "app", "orders",
    "--framework=react", "--skip-install"
  ], { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });

  assert.match(await readFile(join(root, "orders/src/entry.tsx"), "utf8"), /createRoutedMicrofrontend/);
  assert.match(await readFile(join(root, "orders/vite.config.ts"), "utf8"), /remoteEntry\.json/);
  assert.match(await readFile(join(root, "orders/index.html"), "utf8"), /Orders assets/);
  assert.match(await readFile(join(root, "orders/src/exported-components/README.md"), "utf8"), /Create `<widget-id>\/index\.tsx`/);
  assert.equal(await readFile(join(root, "orders/public/nx.txt"), "utf8"), "nx react public asset\n");
  assert.equal(await readFile(join(root, "orders/eslint.config.mjs"), "utf8"), "nx eslint\n");
  assert.equal(JSON.parse(await readFile(join(root, "orders/project.json"), "utf8")).marker, "nx-generator");
  assert.match(stdout, /Delegating React scaffolding to @nx\/react:application at orders/);
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
  assert.equal(projectPackage.dependencies["@atlas/contracts"], "^0.2.17");
  assert.equal(projectPackage.dependencies["@atlas/sdk"], "^0.2.17");
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
