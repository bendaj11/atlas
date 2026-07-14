import assert from "node:assert/strict";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "@jest/globals";
import { run } from "./build.driver.js";

process.chdir(fileURLToPath(new URL("../../..", import.meta.url)));

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
    configMatch: /@atlas\/sdk\/federation-config/
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
    configMatch: /@atlas\/sdk\/federation-config/
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
      assert.equal(architect["serve-original"].options.port, 4201);
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
    dev: "vite --host 0.0.0.0",
    build: "tsc -b && vite build"
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
    dev: "ng serve customer-host",
    build: "ng build"
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
    dev: "vite --host 0.0.0.0",
    build: "tsc -b && vite build"
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
    assert.equal(packageJson.scripts.build, scenario.build);
    assert.equal(packageJson.scripts["atlas:build"], "atlas build customer-host");
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
      assert.equal(architect["serve-original"].options.port, 4200);
      assert.deepEqual(appTsconfig.files, ["src/main.ts", "atlas.config.ts"]);
      assert.equal(appTsconfig.extends, "./tsconfig.json");
      assert.equal(appTsconfig.compilerOptions.emitDeclarationOnly, undefined);
      const rootTsconfig = JSON.parse(await readFile(join(root, scenario.root, "tsconfig.json"), "utf8"));
      assert.equal(rootTsconfig.compilerOptions.target, "ES2022");
      await assert.rejects(access(join(root, scenario.root, "tsconfig.atlas.json")), { code: "ENOENT" });
    }
  });
}

