import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createInstallCommand, createNxGenerationCommand, createNxPluginInstallCommand, createTaskCommand, detectWorkspace } from "../dist/workspace.js";

test("workspace detection discovers an Nx project without consumer configuration", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-"));
  const projectRoot = join(root, "apps", "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({ packageManager: "yarn@1.22.22" }));
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "@acme/orders", version: "1.2.3" }));
  await writeFile(join(projectRoot, "project.json"), JSON.stringify({
    name: "orders",
    targets: { build: { options: { outputPath: "dist/apps/orders" } } }
  }));
  await writeFile(join(projectRoot, "atlas.config.ts"), "export default {};\n");

  const workspace = await detectWorkspace(projectRoot);
  const project = await workspace.findProject("orders");
  assert.equal(workspace.kind, "nx");
  assert.equal(workspace.packageManager, "yarn");
  assert.equal(project.root, projectRoot);
  assert.deepEqual(project.outputPaths, [join(root, "dist", "apps", "orders")]);
  assert.equal(workspace.generationRoot("app", "catalog"), join(root, "apps", "catalog"));
});

test("Nx generation respects a direct child working directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-generation-root-"));
  const appsRoot = join(root, "apps");
  await mkdir(appsRoot);
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));

  const workspace = await detectWorkspace(appsRoot);

  assert.equal(workspace.generationRoot("host", "shell"), join(appsRoot, "shell"));
  assert.equal(workspace.generationRoot("app", "orders"), join(appsRoot, "orders"));
});

test("package.json workspaces establish the workspace root without a lockfile", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-workspaces-"));
  const projectRoot = join(root, "packages", "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "orders", version: "1.0.0" }));
  await writeFile(join(projectRoot, "atlas.config.ts"), "export default {};\n");

  const workspace = await detectWorkspace(projectRoot);
  assert.equal(workspace.root, root);
  assert.equal(workspace.kind, "workspace");
  assert.equal(workspace.generationRoot("app", "catalog"), join(root, "packages", "catalog"));
});

test("pnpm-workspace.yaml establishes a pnpm workspace without package.json workspaces", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-pnpm-workspace-"));
  const projectRoot = join(root, "packages", "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "acme", packageManager: "pnpm@10.0.0" }));
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "orders", version: "1.0.0" }));
  await writeFile(join(projectRoot, "atlas.config.ts"), "export default {};\n");

  const workspace = await detectWorkspace(projectRoot);
  assert.equal(workspace.root, root);
  assert.equal(workspace.kind, "workspace");
  assert.equal(workspace.packageManager, "pnpm");
  assert.equal(workspace.generationRoot("host", "shell"), join(root, "packages", "shell"));
});

test("pnpm-lock.yaml establishes the workspace root", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-pnpm-lock-"));
  const projectRoot = join(root, "packages", "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "acme" }));
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "orders", version: "1.0.0" }));
  await writeFile(join(projectRoot, "atlas.config.ts"), "export default {};\n");

  const workspace = await detectWorkspace(projectRoot);
  assert.equal(workspace.root, root);
  assert.equal(workspace.packageManager, "pnpm");
});

test("Nx discovery includes configured and declared output directories", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-outputs-"));
  const projectRoot = join(root, "packages", "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({ packageManager: "npm@10.0.0" }));
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "@acme/orders", version: "1.0.0" }));
  await writeFile(join(projectRoot, "project.json"), JSON.stringify({
    name: "orders",
    targets: {
      build: {
        defaultConfiguration: "production",
        outputs: ["{workspaceRoot}/custom/{projectName}", "{projectRoot}/public"],
        configurations: { development: { outputPath: "dist/dev/orders" }, production: { outputPath: { base: "dist/orders", browser: "browser" } } }
      }
    }
  }));
  await writeFile(join(projectRoot, "atlas.config.ts"), "export default {};\n");

  const project = await (await detectWorkspace(projectRoot)).findProject("orders");
  assert.deepEqual(project.outputPaths, [
    join(root, "dist/orders/browser"), join(root, "dist/orders"), join(root, "dist/dev/orders"),
    join(root, "custom/orders"), join(projectRoot, "public")
  ]);
});

test("task commands follow Nx, Turbo, and package-manager conventions", () => {
  const project = { id: "orders", root: "/repo/apps/orders", packageName: "@acme/orders", version: "1.0.0", outputPaths: [] };
  assert.deepEqual(createTaskCommand("nx", "yarn", "/repo", project, "build"), {
    command: "yarn", args: ["nx", "run", "orders:build"], cwd: "/repo"
  });
  assert.deepEqual(createTaskCommand("turbo", "pnpm", "/repo", project, "dev", ["--port", "4201"]), {
    command: "pnpm", args: ["exec", "turbo", "run", "dev", "--filter=@acme/orders", "--", "--port", "4201"], cwd: "/repo"
  });
  assert.deepEqual(createTaskCommand("turbo", "yarn", "/repo", project, "dev", ["--port", "4201"]), {
    command: "yarn", args: ["exec", "--", "turbo", "run", "dev", "--filter=@acme/orders", "--", "--port", "4201"], cwd: "/repo"
  });
  assert.deepEqual(createTaskCommand("turbo", "yarn", "/repo", project, "atlas:config"), {
    command: "yarn", args: ["workspace", "@acme/orders", "run", "atlas:config"], cwd: "/repo"
  });
  assert.deepEqual(createTaskCommand("workspace", "npm", "/repo", project, "build"), {
    command: "npm", args: ["run", "build", "--workspace", "@acme/orders"], cwd: "/repo"
  });
});

test("dependency installs use the detected package manager from the generated project", () => {
  assert.deepEqual(createInstallCommand("npm", "/repo", "/repo/apps/orders"), {
    command: "npm", args: ["--globalconfig", "/repo/.npmrc", "install"], cwd: "/repo/apps/orders"
  });
  assert.deepEqual(createInstallCommand("pnpm", "/repo", "/repo/apps/orders"), {
    command: "pnpm", args: ["install"], cwd: "/repo/apps/orders"
  });
});

test("non-interactive Nx projects use deterministic framework generator defaults", () => {
  assert.deepEqual(createNxGenerationCommand("pnpm", "/repo", { framework: "angular", directory: "apps/shell", interactive: false }), {
    command: "pnpm",
    args: [
      "exec", "nx", "generate", "@nx/angular:application", "apps/shell",
      "--interactive=false", "--skipFormat", "--e2eTestRunner=none", "--unitTestRunner=none", "--bundler=esbuild"
    ],
    cwd: "/repo"
  });
  assert.deepEqual(createNxGenerationCommand("yarn", "/repo", { framework: "react", directory: "apps/orders", interactive: false }), {
    command: "yarn",
    args: [
      "nx", "generate", "@nx/react:application", "apps/orders",
      "--interactive=false", "--skipFormat", "--e2eTestRunner=none", "--unitTestRunner=none", "--bundler=vite"
    ],
    cwd: "/repo"
  });
});

test("interactive Nx projects delegate framework choices to the native generator", () => {
  assert.deepEqual(createNxGenerationCommand("yarn", "/repo", {
    framework: "angular", directory: "apps/shell", interactive: true
  }), {
    command: "yarn",
    args: [
      "nx", "generate", "@nx/angular:application", "apps/shell",
      "--interactive=true", "--skipFormat"
    ],
    cwd: "/repo"
  });
});

test("missing Nx plugins are added through the workspace package manager", () => {
  assert.deepEqual(createNxPluginInstallCommand("npm", "/repo", "react"), {
    command: "npx",
    args: ["nx", "add", "@nx/react", "--interactive=false"],
    cwd: "/repo"
  });
});

test("solution-style Nx workspaces still require the native Angular plugin", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-angular-solution-"));
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({
    packageManager: "pnpm@10.0.0",
    workspaces: ["packages/*"]
  }));
  await writeFile(join(root, "tsconfig.json"), JSON.stringify({ files: [], references: [] }));
  await writeFile(join(root, "tsconfig.base.json"), JSON.stringify({
    compilerOptions: { composite: true, declaration: true }
  }));

  const workspace = await detectWorkspace(root);
  assert.equal(await workspace.missingScaffoldDependency("angular"), "@nx/angular");
  assert.equal(workspace.generationRoot("host", "shell"), join(root, "packages", "shell"));
});
