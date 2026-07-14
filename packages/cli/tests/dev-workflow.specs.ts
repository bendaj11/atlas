import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@jest/globals";
import { createTestManifest } from "../../testkit/dist/index.js";
import { CliArguments } from "../dist/arguments.js";
import { AtlasBuildService } from "../dist/build.js";
import { AtlasDevService, remoteEntryIsReady, startLocalBootstrapServer } from "../dist/dev.js";
import {
  availablePort,
  closeServer,
  createTestWorkspace,
  listenWithRemoteEntry,
  run,
  runDevService,
  TestChildProcess,
  testTypeScriptConfig
} from "./build.driver.js";

process.chdir(fileURLToPath(new URL("../../..", import.meta.url)));

const localNetworkTest = process.env.CODEX_SANDBOX_NETWORK_DISABLED === "1" ? test.skip : test;

localNetworkTest("local bootstrap serves runtime, deep links, and real asset 404s", async () => {
  const server = await startLocalBootstrapServer({
    port: 0,
    runtime: {
      schemaVersion: "1",
      hostId: "customer-host",
      catalogUrl: "http://127.0.0.1:4400/hosts/customer-host/catalog.json",
      allowOverrides: true
    }
  });
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected local TCP address.");
    const origin = `http://127.0.0.1:${address.port}`;
    expect(await fetch(`${origin}/atlas.runtime.json`).then((response) => response.json())).toMatchObject({ hostId: "customer-host" });
    expect(await fetch(`${origin}/orders/42`).then((response) => response.text())).toMatch(/atlas-host-root/);
    expect((await fetch(`${origin}/missing.js`)).status).toBe(404);
  } finally {
    await closeServer(server);
  }
});

test("atlas dev rejects apps without a configured host", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-missing-host-"));
  const projectRoot = join(root, "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "orders", version: "1.0.0", type: "module" }));
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify(testTypeScriptConfig()));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "orders",',
    '  name: "Orders",',
    '  framework: "react"',
    "};"
  ].join("\n"));

  await expect(runDevService(root, projectRoot, ["dev", "orders", "--prepare-only"])).rejects.toThrow(/No host configured for "orders"\. Add a route or slot with hostId, or pass --host\./);
});

test("atlas dev prepares a React Native Federation override", async () => {
  const stdout = await run(process.execPath, [
    "packages/cli/dist/index.js", "dev", "dashboard-react",
    "--host=060a7f62-1c95-402c-9993-55749faf36d9", "--host-url=https://host.example/dashboard",
    "--port=4513", "--control-port=4514", "--prepare-only"
  ]);
  const document = JSON.parse(await readFile("examples/apps/dashboard-react/.atlas/local-overrides.json", "utf8"));
  expect(document.overrides[0].manifest.framework).toBe("react");
  expect(document.overrides[0].manifest.remoteEntryUrl).toBe("http://localhost:4513/remoteEntry.json");
  expect(document.overrides[0].manifest.integrity).toBe(undefined);
  expect(stdout).toMatch(/App Preview: https:\/\/host\.example\/dashboard/);
  expect(stdout).not.toMatch(/atlas-override/);
});

test("atlas dev reuses the generated React dev-server port", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-react-port-"));
  const projectRoot = join(root, "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "orders", version: "1.0.0", type: "module" }));
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify(testTypeScriptConfig({ module: "Node16", moduleResolution: "Node16" })));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "orders",',
    '  name: "Orders",',
    '  framework: "react",',
    '  routes: [{ hostId: "customer-host", basePath: "/orders" }]',
    "};"
  ].join("\n"));
  await writeFile(join(projectRoot, "vite.config.ts"), [
    "export default {",
    "  server: { port: 4202, cors: true }",
    "};"
  ].join("\n"));

  await runDevService(root, projectRoot, [
    "dev", "orders", "--host-url=https://host.example/orders", "--prepare-only"
  ]);

  const document = JSON.parse(await readFile(join(projectRoot, ".atlas/local-overrides.json"), "utf8"));
  expect(document.overrides[0].manifest.remoteEntryUrl).toBe("http://localhost:4202/remoteEntry.json");
});

test("atlas dev reuses the generated Angular dev-server port", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-angular-port-"));
  const projectRoot = join(root, "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "orders", version: "1.0.0", type: "module" }));
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify(testTypeScriptConfig({ module: "Node16", moduleResolution: "Node16" })));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "orders",',
    '  name: "Orders",',
    '  framework: "angular",',
    '  routes: [{ hostId: "customer-host", basePath: "/orders" }]',
    "};"
  ].join("\n"));
  await writeFile(join(projectRoot, "angular.json"), JSON.stringify({
    projects: {
      orders: {
        architect: {
          serve: { options: { port: 4203 } },
          "serve-original": { options: { port: 4203 } }
        }
      }
    }
  }));

  await runDevService(root, projectRoot, [
    "dev", "orders", "--host-url=https://host.example/orders", "--prepare-only"
  ]);

  const document = JSON.parse(await readFile(join(projectRoot, ".atlas/local-overrides.json"), "utf8"));
  expect(document.overrides[0].manifest.remoteEntryUrl).toBe("http://localhost:4203/remoteEntry.json");
});

test("atlas dev waits for valid remote federation metadata", async () => {
  expect(await remoteEntryIsReady(new Response("<!DOCTYPE html>", {
    status: 200,
    headers: { "content-type": "text/html" }
  }))).toBe(false);
  expect(await remoteEntryIsReady(new Response("not found", {
    status: 404,
    headers: { "content-type": "application/json" }
  }))).toBe(false);
  expect(await remoteEntryIsReady(new Response(JSON.stringify({ name: "atlas_orders", exposes: [] }), {
    status: 200,
    headers: { "content-type": "application/json" }
  }))).toBe(true);
});

test("atlas dev prepares a versioned local host client", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-host-"));
  const projectRoot = join(root, "customer-host");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "customer-host", version: "1.0.0", type: "module" }));
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify(testTypeScriptConfig()));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  type: "host",',
    '  id: "stable-customer-host-id",',
    '  framework: "react",',
    "  allowOverrides: true",
    "};"
  ].join("\n"));

  const calls: unknown[][] = [];
  const project = { id: "customer-host", root: projectRoot, packageName: "customer-host", version: "1.0.0", outputPaths: [] };
  const workspace = createTestWorkspace({
    kind: "standalone",
    root,
    packageManager: "npm",
    findProject: async () => project,
    run: async (_project, task) => { calls.push(["run", task]); },
    spawn: (_project, task) => {
      calls.push(["spawn", task]);
      const child = new TestChildProcess();
      setImmediate(() => child.finish());
      return child;
    }
  });
  const args = new CliArguments(["dev", "customer-host", "--prepare-only"]);
  const originalInfo = console.info;

  try {
    console.info = () => {};
    await new AtlasDevService(workspace, args, new AtlasBuildService(workspace, args)).run("customer-host");
  } finally {
    console.info = originalInfo;
  }

  expect(calls).toStrictEqual([]);
  const localManifest = JSON.parse(await readFile(join(projectRoot, ".atlas/local-host.manifest.json"), "utf8"));
  const overrides = JSON.parse(await readFile(join(projectRoot, ".atlas/local-overrides.json"), "utf8"));
  expect(localManifest.kind).toBe("host");
  expect(localManifest.channel).toBe("local");
  expect(localManifest.remoteEntryUrl).toBe("http://127.0.0.1:4200/remoteEntry.json");
  expect(overrides.hostOverride.id).toBe("stable-customer-host-id");
  await expect(access(join(projectRoot, "public/atlas.runtime.json"))).rejects.toMatchObject({ code: "ENOENT" });
});

localNetworkTest("atlas dev delegates Nx app projects to the serve task", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-nx-app-"));
  const projectRoot = join(root, "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "orders", version: "1.0.0", type: "module" }));
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify(testTypeScriptConfig()));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "orders",',
    '  name: "Orders",',
    '  framework: "react",',
    '  routes: [{ hostId: "customer-host", basePath: "/orders" }]',
    "};"
  ].join("\n"));

  const remoteServer = await listenWithRemoteEntry();
  const controlPort = await availablePort();
  const calls: unknown[][] = [];
  const project = { id: "orders", root: projectRoot, packageName: "orders", version: "1.0.0", outputPaths: [] };
  const workspace = createTestWorkspace({
    kind: "nx",
    root,
    packageManager: "npm",
    findProject: async (name) => name === "customer-host"
      ? Promise.reject(new Error("host not present"))
      : project,
    run: async (_project, task) => { calls.push(["run", task]); },
    spawn: (_project, task, args) => {
      calls.push(["spawn", task, args]);
      const child = new TestChildProcess();
      setTimeout(() => {
        if (child.killed) return;
        child.finish();
      }, 50);
      return child;
    }
  });
  const args = new CliArguments([
    "dev", "orders",
    "--host=customer-host",
    "--host-url=https://host.example/orders",
    `--port=${remoteServer.port}`,
    `--control-port=${controlPort}`,
    "--no-open"
  ]);
  const builds: Pick<AtlasBuildService, "loadConfig" | "buildManifest"> = {
    loadConfig: async () => ({
      id: "orders",
      name: "Orders",
      framework: "react",
      routes: [{ hostId: "customer-host", basePath: "/orders", title: "Orders" }]
    }),
    buildManifest: async () => createTestManifest({
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

  expect(calls).toStrictEqual([["spawn", "serve", ["--port", String(remoteServer.port)]]]);
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
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify(testTypeScriptConfig()));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  type: "host",',
    '  id: "mobile-host",',
    '  framework: "angular",',
    "  allowOverrides: true",
    "};"
  ].join("\n"));

  const project = { id: "mobile-host", root: projectRoot, packageName: "mobile-host", version: "0.1.0", outputPaths: [] };
  const workspace = createTestWorkspace({
    kind: "standalone",
    root,
    packageManager: "npm",
    findProject: async () => project,
    run: async () => {},
    spawn: () => {
      throw new Error("corrupt Angular build preflight should stop before spawn");
    }
  });
  const args = new CliArguments(["dev", "mobile-host"]);

  await expect(new AtlasDevService(workspace, args, new AtlasBuildService(workspace, args)).run("mobile-host")).rejects.toThrow(/@angular\/build 21\.2\.18 is corrupt.*creadConfiguration/);
});

test("atlas dev compiles atlas.config.ts with the project tsconfig", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-config-compile-"));
  const projectRoot = join(root, "mobile-host");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "mobile-host", version: "0.1.0", type: "module" }));
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify(testTypeScriptConfig({ noEmit: true })));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  type: "host",',
    '  id: "mobile-host",',
    '  framework: "react",',
    "  allowOverrides: true",
    "};"
  ].join("\n"));

  const calls: unknown[][] = [];
  const project = { id: "mobile-host", root: projectRoot, packageName: "mobile-host", version: "0.1.0", outputPaths: [] };
  const workspace = createTestWorkspace({
    kind: "standalone",
    root,
    packageManager: "npm",
    findProject: async () => project,
    run: async (_project, task) => { calls.push(["run", task]); },
    spawn: () => {
      throw new Error("prepare-only should not spawn");
    }
  });
  const args = new CliArguments(["dev", "mobile-host", "--prepare-only"]);
  const originalInfo = console.info;

  try {
    console.info = () => {};
    await new AtlasDevService(workspace, args, new AtlasBuildService(workspace, args)).run("mobile-host");
  } finally {
    console.info = originalInfo;
  }

  await access(join(projectRoot, ".atlas", "atlas.config.js"));
  expect(calls).toStrictEqual([]);
});

test("atlas dev prefers tsconfig.app.json for atlas.config.ts compilation", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-app-tsconfig-"));
  const projectRoot = join(root, "apps", "mobile-host");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "mobile-host", version: "0.1.0", type: "module" }));
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify({ compilerOptions: { emitDeclarationOnly: true } }));
  await writeFile(join(projectRoot, "tsconfig.app.json"), JSON.stringify(testTypeScriptConfig()));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  type: "host",',
    '  id: "mobile-host",',
    '  framework: "react",',
    "  allowOverrides: true",
    "};"
  ].join("\n"));

  const calls: unknown[][] = [];
  const project = { id: "mobile-host", root: projectRoot, packageName: "mobile-host", version: "0.1.0", outputPaths: [] };
  const workspace = createTestWorkspace({
    kind: "nx",
    root,
    packageManager: "npm",
    findProject: async () => project,
    run: async (_project, task) => { calls.push(["run", task]); },
    spawn: () => {
      throw new Error("prepare-only should not spawn");
    }
  });
  const args = new CliArguments(["dev", "mobile-host", "--prepare-only"]);
  const originalInfo = console.info;

  try {
    console.info = () => {};
    await new AtlasDevService(workspace, args, new AtlasBuildService(workspace, args)).run("mobile-host");
  } finally {
    console.info = originalInfo;
  }

  await access(join(projectRoot, ".atlas", "atlas.config.js"));
  expect(calls).toStrictEqual([]);
});
