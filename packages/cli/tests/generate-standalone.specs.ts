import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "@jest/globals";
import { emptyRegistry, run } from "./build.driver.js";

process.chdir(fileURLToPath(new URL("../../..", import.meta.url)));

test("atlas generates a portable Angular host at an explicit directory", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "atlas-generator-"));
  const target = join(temporary, "customer-host");
  await run(process.execPath, ["packages/cli/dist/index.js", "g", "host", "customer-host", "--framework=angular", "--port=4305", "--skip-install", `--directory=${target}`]);
  const main = await readFile(join(target, "src/main.ts"), "utf8");
  const bootstrap = await readFile(join(target, "src/bootstrap.ts"), "utf8");
  await assert.rejects(access(join(target, "public/atlas.runtime.json")), { code: "ENOENT" });
  assert.doesNotMatch(await readFile(join(target, "atlas.config.ts"), "utf8"), /resourcesTimeoutMs/);
  await assert.rejects(access(join(target, "Containerfile")), { code: "ENOENT" });
  const serverMain = await readFile(join(target, "server/main.mts"), "utf8");
  const generatedHostId = (await readFile(join(target, "atlas.config.ts"), "utf8")).match(/id: "([^"]+)"/)?.[1];
  assert.ok(generatedHostId);
  assert.match(serverMain, /runAtlasHostServer/);
  assert.match(serverMain, new RegExp(generatedHostId));
  assert.doesNotMatch(await readFile(join(target, "atlas.config.ts"), "utf8"), /catalogUrl/);
  const generatedPackage = JSON.parse(await readFile(join(target, "package.json"), "utf8"));
  assert.equal(generatedPackage.scripts.build, "ng build");
  assert.equal(generatedPackage.scripts["atlas:build"], "atlas build customer-host");
  assert.equal(generatedPackage.scripts["build:server"], "tsc -p server/tsconfig.json");
  assert.equal(generatedPackage.scripts["start:server"], "node server/dist/main.mjs");
  assert.equal(typeof generatedPackage.dependencies["@atlas/host-server"], "string");
  const angularJson = JSON.parse(await readFile(join(target, "angular.json"), "utf8"));
  const architect = angularJson.projects["customer-host"].architect;
  assert.equal(architect.build.builder, "@angular-architects/native-federation:build");
  assert.equal(architect.build.options.target, "customer-host:esbuild:production");
  assert.deepEqual(architect.esbuild.options.polyfills, ["zone.js", "es-module-shims"]);
  assert.equal(architect.serve.builder, "@angular-architects/native-federation:build");
  assert.equal(architect.serve.options.target, "customer-host:serve-original:development");
  assert.equal(architect.serve.options.port, 4305);
  assert.equal(architect["serve-original"].options.port, 4305);
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
  const hostId = "0a17281f-287b-4d89-a8ca-0ab0e577c506";

  await run(process.execPath, [
    "packages/cli/dist/index.js", "g", "app", "orders",
    "--framework=react", "--skip-install", `--directory=${withoutHost}`
  ]);
  await run(process.execPath, [
    "packages/cli/dist/index.js", "g", "app", "billing",
    "--framework=react", `--host-id=${hostId}`, "--port=4306", "--skip-install", `--directory=${withHost}`
  ]);

  const defaultConfig = await readFile(join(withoutHost, "atlas.config.ts"), "utf8");
  assert.doesNotMatch(defaultConfig, /hostCompatibility/);
  assert.doesNotMatch(defaultConfig, /placements/);
  assert.doesNotMatch(defaultConfig, /mounts/);
  assert.doesNotMatch(defaultConfig, /routes/);
  assert.doesNotMatch(defaultConfig, /"host"/);

  const explicitConfig = await readFile(join(withHost, "atlas.config.ts"), "utf8");
  assert.match(await readFile(join(withHost, "vite.config.ts"), "utf8"), /server: \{ port: 4306, cors: true \}/);
  assert.doesNotMatch(explicitConfig, /hostCompatibility/);
  assert.match(explicitConfig, /routes: \[/);
  assert.match(explicitConfig, new RegExp(`hostId: "${hostId}"`));
  assert.doesNotMatch(explicitConfig, /hostId: "host"/);
});

test("atlas app generation rejects the removed host project option", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "atlas-app-generator-"));
  const target = join(temporary, "orders");

  await assert.rejects(run(process.execPath, [
    "packages/cli/dist/index.js", "g", "app", "orders",
    "--framework=react", "--host=customer-host", "--skip-install", `--directory=${target}`
  ]), /Unknown option "--host" for app generation\. Use --host-id\./);
});

test("atlas app generation can create single-page apps without inner route files", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "atlas-single-page-generator-"));
  const reactRoot = join(temporary, "orders");
  const angularRoot = join(temporary, "billing");

  await run(process.execPath, [
    "packages/cli/dist/index.js", "g", "app", "orders",
    "--framework=react", "--no-routing", "--skip-install", `--directory=${reactRoot}`
  ]);
  await run(process.execPath, [
    "packages/cli/dist/index.js", "g", "app", "billing",
    "--framework=angular", "--no-routing", "--skip-install", `--directory=${angularRoot}`
  ]);

  const reactPackage = JSON.parse(await readFile(join(reactRoot, "package.json"), "utf8"));
  assert.equal(reactPackage.dependencies["react-router-dom"], undefined);
  assert.match(await readFile(join(reactRoot, "src/entry.tsx"), "utf8"), /defineApp/);
  assert.doesNotMatch(await readFile(join(reactRoot, "src/entry.tsx"), "utf8"), /createRoutedApp|RouterProvider/);
  assert.match(await readFile(join(reactRoot, "src/app/App.tsx"), "utf8"), /Single-page Atlas app/);
  await assert.rejects(access(join(reactRoot, "src/app/routes.tsx")), { code: "ENOENT" });
  await assert.rejects(access(join(reactRoot, "src/app/home/Home.tsx")), { code: "ENOENT" });
  await assert.rejects(access(join(reactRoot, "src/app/details/Details.tsx")), { code: "ENOENT" });

  const angularPackage = JSON.parse(await readFile(join(angularRoot, "package.json"), "utf8"));
  assert.equal(angularPackage.dependencies["@angular/router"], undefined);
  assert.match(await readFile(join(angularRoot, "src/entry.ts"), "utf8"), /defineApp/);
  assert.doesNotMatch(await readFile(join(angularRoot, "src/entry.ts"), "utf8"), /provideRouter|LocationStrategy/);
  assert.match(await readFile(join(angularRoot, "src/app/app.component.ts"), "utf8"), /Single-page Atlas app/);
  await assert.rejects(access(join(angularRoot, "src/app/routes.ts")), { code: "ENOENT" });
  await assert.rejects(access(join(angularRoot, "src/app/home/home.component.ts")), { code: "ENOENT" });
  await assert.rejects(access(join(angularRoot, "src/app/details/details.component.ts")), { code: "ENOENT" });
});

test("atlas build identifies and versions a host client", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-runtime-config-"));
  const projectRoot = join(root, "host");
  const publication = join(root, "publication");
  const plan = join(root, "publication.json");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "acme", private: true, workspaces: ["host"] }));
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "host", version: "0.1.0", type: "module" }));
  await writeFile(join(projectRoot, "atlas.config.ts"), "export default {};\n");
  await mkdir(join(projectRoot, ".atlas"));
  await mkdir(join(projectRoot, "dist"));
  await writeFile(join(projectRoot, "dist/remoteEntry.json"), JSON.stringify({ name: "atlas_host", exposes: [{ key: "./host", outFileName: "host.js" }], shared: [] }));
  await writeFile(join(projectRoot, "dist/host.js"), "export const mount = () => {};\n");
  const snapshot = join(root, "registry.json");
  await writeFile(snapshot, JSON.stringify(emptyRegistry()));
  await writeFile(join(projectRoot, ".atlas/atlas.config.js"), `export default {
    type: "host",
    id: "host",
    framework: "react",
    name: "Host"
  };\n`);

  await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "build", "host",
    "--skip-compile", "--registry-base-url=https://cdn.example/atlas",
    `--registry-snapshot=${snapshot}`,
    `--publication-directory=${publication}`, `--publication-plan=${plan}`
  ], { cwd: root });

  const manifest = JSON.parse(await readFile(join(projectRoot, "dist/host.manifest.json"), "utf8"));
  const catalog = JSON.parse(await readFile(join(publication, "hosts/host/catalog.json"), "utf8"));
  assert.equal(manifest.kind, "host");
  assert.equal(manifest.version, "0.1.0");
  assert.equal(manifest.remoteEntryUrl.startsWith("https://cdn.example/atlas/hosts/host/0.1.0/"), true);
  assert.equal(catalog.host.id, "host");
  assert.deepEqual(catalog.apps, []);
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
    '  routes: [{ hostId: "customer-host", basePath: "/orders", title: "Orders" }]',
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
