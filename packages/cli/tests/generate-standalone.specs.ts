import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@jest/globals";
import { emptyRegistry, run } from "./build.driver.js";

process.chdir(fileURLToPath(new URL("../../..", import.meta.url)));

test("atlas generates a portable Angular host at an explicit directory", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "atlas-generator-"));
  const target = join(temporary, "customer-host");
  await run(process.execPath, ["packages/cli/dist/index.js", "g", "host", "customer-host", "--framework=angular", "--port=4305", "--skip-install", `--directory=${target}`]);
  const main = await readFile(join(target, "src/main.ts"), "utf8");
  const bootstrap = await readFile(join(target, "src/bootstrap.ts"), "utf8");
  expect(await readFile(join(target, "atlas.bootstrap.html"), "utf8")).toMatch(/id="atlas-host-root">Loading product…<\/div>/);
  await expect(access(join(target, "public/atlas.runtime.json"))).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readFile(join(target, "atlas.config.ts"), "utf8")).not.toMatch(/resourcesTimeoutMs/);
  await expect(access(join(target, "Containerfile"))).rejects.toMatchObject({ code: "ENOENT" });
  await expect(access(join(target, "server"))).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readFile(join(target, "atlas.config.ts"), "utf8")).not.toMatch(/catalogUrl/);
  const generatedPackage = JSON.parse(await readFile(join(target, "package.json"), "utf8"));
  expect(generatedPackage.scripts.build).toBe("ng build");
  expect(generatedPackage.scripts["atlas:build"]).toBe("atlas build customer-host");
  expect(generatedPackage.scripts["build:server"]).toBe(undefined);
  expect(generatedPackage.dependencies["@atlas/bootstrap"]).toBe(undefined);
  const angularJson = JSON.parse(await readFile(join(target, "angular.json"), "utf8"));
  const architect = angularJson.projects["customer-host"].architect;
  expect(architect.build.builder).toBe("@angular-architects/native-federation:build");
  expect(architect.build.options.target).toBe("customer-host:esbuild:production");
  expect(architect.esbuild.options.polyfills).toStrictEqual(["zone.js", "es-module-shims"]);
  expect(architect.serve.builder).toBe("@angular-architects/native-federation:build");
  expect(architect.serve.options.target).toBe("customer-host:serve-original:development");
  expect(architect.serve.options.port).toBe(4305);
  expect(architect["serve-original"].options.port).toBe(4305);
  expect(main).toMatch(/initFederation/);
  expect(bootstrap).toMatch(/startHost/);
  expect(bootstrap).toMatch(/AtlasHostDefaultRouteComponent/);
  expect(bootstrap).not.toMatch(/AtlasDefaultHostRouteComponent/);
  expect(bootstrap).not.toMatch(/localhost:4300/);
  expect(await readFile(join(target, "src/app/atlas-host-default-route.component.ts"), "utf8")).toMatch(/standalone: true/);
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
  expect(defaultConfig).not.toMatch(/hostCompatibility/);
  expect(defaultConfig).not.toMatch(/placements/);
  expect(defaultConfig).not.toMatch(/mounts/);
  expect(defaultConfig).not.toMatch(/routes/);
  expect(defaultConfig).not.toMatch(/"host"/);

  const explicitConfig = await readFile(join(withHost, "atlas.config.ts"), "utf8");
  expect(await readFile(join(withHost, "vite.config.ts"), "utf8")).toMatch(/server: \{ port: 4306, cors: true \}/);
  expect(explicitConfig).not.toMatch(/hostCompatibility/);
  expect(explicitConfig).toMatch(/routes: \[/);
  expect(explicitConfig).toMatch(new RegExp(`hostId: "${hostId}"`));
  expect(explicitConfig).not.toMatch(/hostId: "host"/);
});

test("atlas app generation rejects the removed host project option", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "atlas-app-generator-"));
  const target = join(temporary, "orders");

  await expect(run(process.execPath, [
    "packages/cli/dist/index.js", "g", "app", "orders",
    "--framework=react", "--host=customer-host", "--skip-install", `--directory=${target}`
  ])).rejects.toThrow(/Unknown option "--host" for app generation\. Use --host-id\./);
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
  expect(reactPackage.dependencies["react-router-dom"]).toBe(undefined);
  expect(await readFile(join(reactRoot, "src/entry.tsx"), "utf8")).toMatch(/defineApp/);
  expect(await readFile(join(reactRoot, "src/entry.tsx"), "utf8")).not.toMatch(/createRoutedApp|RouterProvider/);
  expect(await readFile(join(reactRoot, "src/app/App.tsx"), "utf8")).toMatch(/Single-page Atlas app/);
  await expect(access(join(reactRoot, "src/app/routes.tsx"))).rejects.toMatchObject({ code: "ENOENT" });
  await expect(access(join(reactRoot, "src/app/home/Home.tsx"))).rejects.toMatchObject({ code: "ENOENT" });
  await expect(access(join(reactRoot, "src/app/details/Details.tsx"))).rejects.toMatchObject({ code: "ENOENT" });

  const angularPackage = JSON.parse(await readFile(join(angularRoot, "package.json"), "utf8"));
  expect(angularPackage.dependencies["@angular/router"]).toBe(undefined);
  expect(await readFile(join(angularRoot, "src/entry.ts"), "utf8")).toMatch(/defineApp/);
  expect(await readFile(join(angularRoot, "src/entry.ts"), "utf8")).not.toMatch(/provideRouter|LocationStrategy/);
  expect(await readFile(join(angularRoot, "src/app/app.component.ts"), "utf8")).toMatch(/Single-page Atlas app/);
  await expect(access(join(angularRoot, "src/app/routes.ts"))).rejects.toMatchObject({ code: "ENOENT" });
  await expect(access(join(angularRoot, "src/app/home/home.component.ts"))).rejects.toMatchObject({ code: "ENOENT" });
  await expect(access(join(angularRoot, "src/app/details/details.component.ts"))).rejects.toMatchObject({ code: "ENOENT" });
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
  expect(manifest.kind).toBe("host");
  expect(manifest.version).toBe("0.1.0");
  expect(manifest.remoteEntryUrl.startsWith("https://cdn.example/atlas/hosts/host/0.1.0/")).toBe(true);
  expect(catalog.host.id).toBe("host");
  expect(catalog.apps).toStrictEqual([]);
});

test("atlas build-bootstrap emits deployable static files", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-bootstrap-build-"));
  const projectRoot = join(root, "host");
  await mkdir(join(projectRoot, ".atlas"), { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "acme", private: true, workspaces: ["host"] }));
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "host", version: "2.1.0", type: "module" }));
  await writeFile(join(projectRoot, "atlas.config.ts"), "export default {};\n");
  await writeFile(join(projectRoot, "atlas.bootstrap.html"), '<main id="atlas-host-root">Project loading UI</main><script type="module" src="/atlas.loader.js"></script>\n');
  await writeFile(join(projectRoot, "other.bootstrap.html"), '<main id="atlas-host-root">Explicit loading UI</main><script type="module" src="/atlas.loader.js"></script>\n');
  await writeFile(join(projectRoot, ".atlas/atlas.config.js"), `export default {
    type: "host",
    id: "customer-host",
    framework: "react",
    allowOverrides: true
  };\n`);

  await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "build-bootstrap", "host",
    "--skip-compile", "--registry-base-url=https://cdn.example/atlas"
  ], { cwd: root });

  const output = join(projectRoot, "dist/bootstrap");
  const runtime = JSON.parse(await readFile(join(output, "atlas.runtime.json"), "utf8"));
  expect(runtime.hostId).toBe("customer-host");
  expect(runtime.hostVersion).toBe("2.1.0");
  expect(runtime.catalogUrl).toBe("https://cdn.example/atlas/hosts/customer-host/catalog.json");
  expect(await readFile(join(output, "index.html"), "utf8")).toMatch(/Project loading UI/);
  expect(await readFile(join(output, "atlas.loader.js"), "utf8")).toMatch(/requiredLoaderApiVersion/);
  expect(await readFile(join(output, "nginx.conf"), "utf8")).toMatch(/try_files \$uri \$uri\/ \/index\.html/);

  const explicitOutput = join(projectRoot, "dist/explicit-bootstrap");
  await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "build-bootstrap", "host",
    "--skip-compile", "--registry-base-url=https://cdn.example/atlas",
    "--template=other.bootstrap.html", `--out=${explicitOutput}`
  ], { cwd: root });
  expect(await readFile(join(explicitOutput, "index.html"), "utf8")).toMatch(/Explicit loading UI/);
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

  await expect(run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"), "g", "host", "customer-host",
    "--framework=angular", "--skip-workspace-generator", `--directory=${target}`
  ], { cwd: temporary, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } })).rejects.toThrow(/npm exited with code 1/);
  await expect(access(target)).rejects.toMatchObject({ code: "ENOENT" });
});
