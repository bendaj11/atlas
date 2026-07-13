import { readFile } from "node:fs/promises";
import { ChildProcess } from "node:child_process";
import { createTestManifest } from "../../testkit/dist/index.js";
import type { AtlasHostManifest } from "../../schema/dist/index.js";
import { startControlServer, type AtlasDevOverrideDocument } from "../dist/dev.js";
import type { AtlasProject, AtlasWorkspace } from "../dist/workspace.js";

const defaultProject: AtlasProject = {
  id: "test-project",
  root: "/workspace/test-project",
  packageName: "test-project",
  version: "1.0.0",
  outputPaths: []
};

export function createTestWorkspace(overrides: Partial<AtlasWorkspace> = {}): AtlasWorkspace {
  return {
    kind: "standalone",
    root: "/workspace",
    packageManager: "npm",
    async findProject() { return defaultProject; },
    async run() {},
    spawn() { throw new Error("Workspace spawn was not expected."); },
    async formatGenerated() { return false; },
    async installDependencies() {},
    async missingScaffoldDependency() { return undefined; },
    async installScaffoldDependency() {},
    async scaffoldProject() { return false; },
    generationRoot(_type, name) { return `/workspace/${name}`; },
    ...overrides
  };
}

export class TestChildProcess extends ChildProcess {
  override kill(signal: NodeJS.Signals | number = "SIGTERM"): boolean {
    const signalCode = typeof signal === "string" ? signal : "SIGTERM";
    this.emit("exit", null, signalCode);
    return true;
  }

  finish(exitCode = 0): void {
    this.emit("exit", exitCode, null);
  }
}

export async function atlasPackageRange(): Promise<string> {
  const packageJson = JSON.parse(await readFile(new URL("../../generators/package.json", import.meta.url), "utf8"));
  return `^${packageJson.version}`;
}

export async function hostJoiningSharedControlBecomesReady(): Promise<string> {
  const app = await startControlServer(0, appDocument(), "");
  const host = await startControlServer(app.port, hostDocument(), "");
  try {
    await app.markReady();
    await host.markReady();
    return await selectedHostId(app.port);
  } finally {
    await host.close();
    await app.close();
  }
}

export async function closingJoinedAppPreservesHost(): Promise<string> {
  const host = await startControlServer(0, hostDocument(), "");
  const app = await startControlServer(host.port, appDocument(), "");
  try {
    await host.markReady();
    await app.markReady();
    await app.close();
    return await selectedHostId(host.port);
  } finally {
    await host.close();
  }
}

function appDocument(): AtlasDevOverrideDocument {
  const manifest = createTestManifest({ id: "login", supportedHosts: ["mobile-host"] });
  return {
    schemaVersion: "1",
    hostId: "mobile-host",
    generatedAt: "2026-07-09T08:02:37.622Z",
    overrides: [{ appId: manifest.id, manifest, reason: "local" }]
  };
}

function hostDocument(): AtlasDevOverrideDocument {
  return {
    schemaVersion: "1",
    hostId: "mobile-host",
    hostOverride: localHostManifest(),
    overrides: [],
    generatedAt: "2026-07-09T08:02:37.622Z"
  };
}

function localHostManifest(): AtlasHostManifest {
  return {
    schemaVersion: "1",
    kind: "host",
    id: "mobile-host",
    name: "Mobile Host",
    version: "1.0.0",
    buildId: "local",
    channel: "local",
    framework: "react",
    remoteEntryUrl: "http://127.0.0.1:4200/remoteEntry.json",
    exposes: { entry: "./host" },
    requiredLoaderApiVersion: "^1.0.0",
    createdAt: "2026-07-09T08:02:37.622Z"
  };
}

async function selectedHostId(port: number): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${port}/hosts/mobile-host/catalog.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Control server returned ${response.status}.`);
  const catalog = await response.json() as { host?: { id?: unknown } };
  if (typeof catalog.host?.id !== "string") throw new Error("Control server returned invalid host catalog.");
  return catalog.host.id;
}
