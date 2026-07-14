import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@jest/globals";
import { createFormatGeneratedCommand, createInstallCommand, createNxGenerationCommand, createNxHostServerGenerationCommand, createNxPluginInstallCommand, createTaskCommand, detectWorkspace, installationRoot } from "../dist/workspace.js";
import { createWorkspaceFixture } from "./workspace.driver.js";

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
  const currentProject = await workspace.findProject(".");
  expect(workspace.kind).toBe("nx");
  expect(workspace.packageManager).toBe("yarn");
  expect(project.root).toBe(projectRoot);
  expect(currentProject.root).toBe(projectRoot);
  expect(project.outputPaths).toStrictEqual([join(root, "dist", "apps", "orders")]);
  expect(workspace.generationRoot("app", "catalog")).toBe(join(root, "apps", "catalog"));
});

test("Nx generation respects a direct child working directory", async () => {
  const root = await createWorkspaceFixture("atlas-nx-generation-root-", {
    "nx.json": "{}\n",
    "package.json": JSON.stringify({ workspaces: ["packages/*"] })
  });
  const appsRoot = join(root, "apps");
  await mkdir(appsRoot);

  const workspace = await detectWorkspace(appsRoot);

  expect(workspace.generationRoot("host", "host")).toBe(join(appsRoot, "host"));
  expect(workspace.generationRoot("app", "orders")).toBe(join(appsRoot, "orders"));
});

test("package.json workspaces establish the workspace root without a lockfile", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-workspaces-"));
  const projectRoot = join(root, "packages", "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "orders", version: "1.0.0" }));
  await writeFile(join(projectRoot, "atlas.config.ts"), "export default {};\n");

  const workspace = await detectWorkspace(projectRoot);
  expect(workspace.root).toBe(root);
  expect(workspace.kind).toBe("workspace");
  expect(workspace.generationRoot("app", "catalog")).toBe(join(root, "packages", "catalog"));
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
  expect(workspace.root).toBe(root);
  expect(workspace.kind).toBe("workspace");
  expect(workspace.packageManager).toBe("pnpm");
  expect(workspace.generationRoot("host", "host")).toBe(join(root, "packages", "host"));
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
  expect(workspace.root).toBe(root);
  expect(workspace.packageManager).toBe("pnpm");
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
  expect(project.outputPaths).toStrictEqual([
    join(root, "dist/orders/browser"), join(root, "dist/orders"), join(root, "dist/dev/orders"),
    join(root, "custom/orders"), join(projectRoot, "public")
  ]);
});

test("Nx discovery follows Angular native federation delegated build output", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-angular-native-outputs-"));
  const projectRoot = join(root, "apps", "mobile-host");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(root, "nx.json"), "{}\n");
  await writeFile(join(root, "package.json"), JSON.stringify({ packageManager: "npm@10.0.0" }));
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "@acme/mobile-host", version: "1.0.0" }));
  await writeFile(join(projectRoot, "project.json"), JSON.stringify({
    name: "mobile-host",
    targets: {
      build: {
        executor: "@angular-architects/native-federation:build",
        options: { target: "mobile-host:esbuild:production" }
      },
      esbuild: {
        executor: "@nx/angular:application",
        options: { outputPath: { base: "apps/mobile-host/dist", browser: "browser" } }
      }
    }
  }));
  await writeFile(join(projectRoot, "atlas.config.ts"), "export default {};\n");

  const project = await (await detectWorkspace(projectRoot)).findProject("mobile-host");

  expect(project.outputPaths).toStrictEqual([
    join(root, "apps/mobile-host/dist/browser"), join(root, "apps/mobile-host/dist")
  ]);
});

test("task commands follow Nx, Turbo, and package-manager conventions", () => {
  const project = { id: "orders", root: "/repo/apps/orders", packageName: "@acme/orders", version: "1.0.0", outputPaths: [] };
  expect(createTaskCommand("nx", "yarn", "/repo", project, "build")).toStrictEqual({
    command: "yarn", args: ["nx", "run", "orders:build"], cwd: "/repo"
  });
  expect(createTaskCommand("turbo", "pnpm", "/repo", project, "dev", ["--port", "4201"])).toStrictEqual({
    command: "pnpm", args: ["exec", "turbo", "run", "dev", "--filter=@acme/orders", "--", "--port", "4201"], cwd: "/repo"
  });
  expect(createTaskCommand("turbo", "yarn", "/repo", project, "dev", ["--port", "4201"])).toStrictEqual({
    command: "yarn", args: ["exec", "--", "turbo", "run", "dev", "--filter=@acme/orders", "--", "--port", "4201"], cwd: "/repo"
  });
  expect(createTaskCommand("turbo", "yarn", "/repo", project, "atlas:config")).toStrictEqual({
    command: "yarn", args: ["workspace", "@acme/orders", "run", "atlas:config"], cwd: "/repo"
  });
  expect(createTaskCommand("workspace", "npm", "/repo", project, "build")).toStrictEqual({
    command: "npm", args: ["run", "build", "--workspace", "@acme/orders"], cwd: "/repo"
  });
  expect(createTaskCommand("workspace", "pnpm", "/repo", project, "dev", ["--port", "4201"])).toStrictEqual({
    command: "pnpm", args: ["--filter", "@acme/orders", "run", "dev", "--port", "4201"], cwd: "/repo"
  });
  expect(createTaskCommand("workspace", "yarn", "/repo", project, "dev", ["--port", "4201"])).toStrictEqual({
    command: "yarn", args: ["workspace", "@acme/orders", "run", "dev", "--port", "4201"], cwd: "/repo"
  });
});

test("dependency installs use the detected package manager from the generated project", async () => {
  expect(createInstallCommand("npm", "/repo", "/repo/apps/orders")).toStrictEqual({
    command: "npm", args: ["install"], cwd: "/repo/apps/orders"
  });
  expect(createInstallCommand("pnpm", "/repo", "/repo/apps/orders")).toStrictEqual({
    command: "pnpm", args: ["install"], cwd: "/repo/apps/orders"
  });
  const root = await mkdtemp(join(tmpdir(), "atlas-install-root-"));
  const projectRoot = join(root, "apps/orders");
  await mkdir(projectRoot, { recursive: true });
  expect(await installationRoot("nx", root, projectRoot)).toBe(root);
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "@acme/orders" }));
  expect(await installationRoot("nx", root, projectRoot)).toBe(projectRoot);
  expect(await installationRoot("turbo", root, projectRoot)).toBe(projectRoot);
});

test("generated project formatting uses existing workspace tooling", async () => {
  const nxRoot = await mkdtemp(join(tmpdir(), "atlas-nx-format-command-"));
  await writeFile(join(nxRoot, "package.json"), JSON.stringify({ devDependencies: { nx: "22.0.0" } }));
  expect(await createFormatGeneratedCommand("nx", "yarn", nxRoot, join(nxRoot, "apps", "orders"))).toStrictEqual({
    command: "yarn", args: ["nx", "format:write", "apps/orders"], cwd: nxRoot, stdio: ["ignore", "ignore", "inherit"]
  });

  const root = await mkdtemp(join(tmpdir(), "atlas-format-command-"));
  const projectRoot = join(root, "apps", "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ scripts: { format: "prettier --write ." } }));
  expect(await createFormatGeneratedCommand("workspace", "pnpm", root, projectRoot)).toStrictEqual({
    command: "pnpm", args: ["run", "format"], cwd: projectRoot, stdio: ["ignore", "ignore", "inherit"]
  });

  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ scripts: { lint: "eslint ." } }));
  expect(await createFormatGeneratedCommand("workspace", "npm", root, projectRoot)).toStrictEqual({
    command: "npm", args: ["run", "lint", "--", "--fix"], cwd: projectRoot, stdio: ["ignore", "ignore", "inherit"]
  });
});

test("non-interactive Nx projects use deterministic framework generator defaults", () => {
  expect(createNxGenerationCommand("pnpm", "/repo", { framework: "angular", type: "host", directory: "apps/host", interactive: false, routing: true })).toStrictEqual({
    command: "pnpm",
    args: [
      "exec", "nx", "generate", "@nx/angular:application", "apps/host",
      "--interactive=false", "--skipFormat", "--routing=true", "--port=4200",
      "--ssr=false",
      "--e2eTestRunner=none", "--unitTestRunner=none", "--bundler=esbuild"
    ],
    cwd: "/repo"
  });
  expect(createNxGenerationCommand("yarn", "/repo", { framework: "react", type: "app", directory: "apps/orders", interactive: false, routing: false })).toStrictEqual({
    command: "yarn",
    args: [
      "nx", "generate", "@nx/react:application", "apps/orders",
      "--interactive=false", "--skipFormat", "--routing=false", "--port=4201",
      "--e2eTestRunner=none", "--unitTestRunner=none", "--bundler=vite"
    ],
    cwd: "/repo"
  });
  expect(createNxGenerationCommand("pnpm", "/repo", {
    framework: "angular", type: "app", directory: "apps/orders", devServerPort: 4202, interactive: false, routing: true
  })).toStrictEqual({
    command: "pnpm",
    args: [
      "exec", "nx", "generate", "@nx/angular:application", "apps/orders",
      "--interactive=false", "--skipFormat", "--routing=true", "--port=4202",
      "--ssr=false",
      "--e2eTestRunner=none", "--unitTestRunner=none", "--bundler=esbuild"
    ],
    cwd: "/repo"
  });
  expect(createNxGenerationCommand("pnpm", "/repo", {
    framework: "react", type: "host", directory: "apps/host", devServerPort: 4300, interactive: false, routing: true
  })).toStrictEqual({
    command: "pnpm",
    args: [
      "exec", "nx", "generate", "@nx/react:application", "apps/host",
      "--interactive=false", "--skipFormat", "--routing=true", "--port=4300",
      "--e2eTestRunner=none", "--unitTestRunner=none", "--bundler=vite"
    ],
    cwd: "/repo"
  });
});

test("interactive Nx projects delegate supported framework choices to the native generator", () => {
  expect(createNxGenerationCommand("yarn", "/repo", {
    framework: "angular", type: "host", directory: "apps/host", interactive: true, routing: true
  })).toStrictEqual({
    command: "yarn",
    args: [
      "nx", "generate", "@nx/angular:application", "apps/host",
      "--interactive=true", "--skipFormat", "--routing=true", "--port=4200", "--ssr=false"
    ],
    cwd: "/repo"
  });
  expect(createNxGenerationCommand("pnpm", "/repo", {
    framework: "react", type: "host", directory: "apps/host", interactive: true, routing: true
  })).toStrictEqual({
    command: "pnpm",
    args: [
      "exec", "nx", "generate", "@nx/react:application", "apps/host",
      "--interactive=true", "--skipFormat", "--routing=true", "--port=4200"
    ],
    cwd: "/repo"
  });
});

test("missing Nx plugins are added through the workspace package manager", () => {
  expect(createNxPluginInstallCommand("npm", "/repo", "react")).toStrictEqual({
    command: "npx",
    args: ["nx", "add", "@nx/react", "--interactive=false"],
    cwd: "/repo"
  });
  expect(createNxPluginInstallCommand("pnpm", "/repo", "node")).toStrictEqual({
    command: "pnpm",
    args: ["exec", "nx", "add", "@nx/node", "--interactive=false"],
    cwd: "/repo"
  });
});

test("Nx host servers use the native Node application generator", () => {
  expect(createNxHostServerGenerationCommand("yarn", "/repo", {
    directory: "apps/customer-host-server",
    interactive: false
  })).toStrictEqual({
    command: "yarn",
    args: [
      "nx", "generate", "@nx/node:application", "apps/customer-host-server",
      "--interactive=false", "--skipFormat", "--useProjectJson=true",
      "--bundler=esbuild", "--e2eTestRunner=none", "--unitTestRunner=none", "--linter=none"
    ],
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
  expect(await workspace.missingScaffoldDependency("angular")).toBe("@nx/angular");
  expect(await workspace.missingScaffoldDependency("node")).toBe("@nx/node");
  expect(workspace.generationRoot("host", "host")).toBe(join(root, "packages", "host"));
});
