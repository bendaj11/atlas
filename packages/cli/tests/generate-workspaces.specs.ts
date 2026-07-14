import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@jest/globals";
import { run } from "./build.driver.js";

process.chdir(fileURLToPath(new URL("../../..", import.meta.url)));

test("atlas generation registers projects with Nx automatically", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-generator-"));
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "acme", private: true, packageManager: "yarn@1.22.22" }));
  const stdout = await run(process.execPath, [join(process.cwd(), "packages/cli/dist/index.js"), "g", "app", "orders", "--framework=react", "--skip-install", "--skip-workspace-generator"], { cwd: root });
  const project = JSON.parse(await readFile(join(root, "orders/project.json"), "utf8"));
  expect(project.name).toBe("orders");
  expect(project.targets.build.executor).toBe("nx:run-commands");
  expect(project.targets["atlas:config"].options.cwd).toBe("orders");
  expect(project.targets["atlas:config"].outputs).toStrictEqual(["{projectRoot}/.atlas"]);
  expect(project.targets["atlas:config"].options.command).toBe("yarn run atlas:config");
  expect(project.targets.serve.options.cwd).toBe("orders");
  expect(project.targets.serve.options.command).toBe("yarn run dev");
  expect(project.targets.dev.options.command).toBe("atlas dev orders");
  expect(project.targets.dev.options.forwardAllArgs).toBe(true);
  expect(project.targets.orders.options.command).toBe("nx run orders:dev");
  expect(stdout).toMatch(/Detected an Nx workspace/);
  expect(stdout).toMatch(/Native Nx scaffolding was skipped; Atlas will generate the React scaffold directly at orders/);
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
    expect(await readFile(join(projectRoot, scenario.entry), "utf8")).toMatch(scenario.match);
    expect(await readFile(join(projectRoot, scenario.config), "utf8")).toMatch(scenario.configMatch);
    expect(await readFile(join(projectRoot, "atlas.config.ts"), "utf8")).toMatch(new RegExp(`framework: "${scenario.framework}"`));
    expect(JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8")).name).toBe("orders");
    if (scenario.framework === "angular") {
      const angularJson = JSON.parse(await readFile(join(projectRoot, "angular.json"), "utf8"));
      const architect = angularJson.projects.orders.architect;
      expect(architect.build.builder).toBe("@angular-architects/native-federation:build");
      expect(architect.build.options.target).toBe("orders:esbuild:production");
      expect(architect.esbuild.options.polyfills).toStrictEqual(["zone.js", "es-module-shims"]);
      expect(architect.serve.builder).toBe("@angular-architects/native-federation:build");
      expect(architect.serve.options.target).toBe("orders:serve-original:development");
      expect(architect.serve.options.port).toBe(4201);
      expect(architect["serve-original"].options.port).toBe(4201);
    }
    expect(stdout).toMatch(new RegExp(`Detected ${scenario.name === "Turborepo" ? "a Turborepo" : "a package-manager"} workspace`));
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
    const serverRoot = `${join(root, scenario.root)}-server`;
    const serverPackageJson = JSON.parse(await readFile(join(serverRoot, "package.json"), "utf8"));
    expect(packageJson.scripts.dev).toBe(scenario.dev);
    expect(packageJson.scripts["atlas:config"]).toBe("atlas compile-config customer-host");
    expect(packageJson.scripts.build).toBe(scenario.build);
    expect(packageJson.scripts["atlas:build"]).toBe("atlas build customer-host");
    expect(packageJson.dependencies["@atlas/host-server"]).toBe(undefined);
    expect(serverPackageJson.name).toBe("customer-host-server");
    expect(serverPackageJson.scripts.build).toBe("tsc -p tsconfig.json");
    expect(await readFile(join(serverRoot, "main.mts"), "utf8")).toMatch(/app\.use\(atlas\(/);
    if (scenario.framework === "angular") {
      const appTsconfig = JSON.parse(await readFile(join(root, scenario.root, "tsconfig.app.json"), "utf8"));
      const angularJson = JSON.parse(await readFile(join(root, scenario.root, "angular.json"), "utf8"));
      const architect = angularJson.projects["customer-host"].architect;
      expect(architect.build.builder).toBe("@angular-architects/native-federation:build");
      expect(architect.build.options.target).toBe("customer-host:esbuild:production");
      expect(architect.esbuild.options.polyfills).toStrictEqual(["zone.js", "es-module-shims"]);
      expect(architect.serve.builder).toBe("@angular-architects/native-federation:build");
      expect(architect.serve.options.target).toBe("customer-host:serve-original:development");
      expect(architect.serve.options.port).toBe(4200);
      expect(architect["serve-original"].options.port).toBe(4200);
      expect(appTsconfig.files).toStrictEqual(["src/main.ts", "atlas.config.ts"]);
      expect(appTsconfig.extends).toBe("./tsconfig.json");
      expect(appTsconfig.compilerOptions.emitDeclarationOnly).toBe(undefined);
      const rootTsconfig = JSON.parse(await readFile(join(root, scenario.root, "tsconfig.json"), "utf8"));
      expect(rootTsconfig.compilerOptions.target).toBe("ES2022");
      await expect(access(join(root, scenario.root, "tsconfig.atlas.json"))).rejects.toMatchObject({ code: "ENOENT" });
    }
  });
}
