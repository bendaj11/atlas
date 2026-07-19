import { readFile } from "node:fs/promises";
import { ChildProcess, spawn, type SpawnOptions } from "node:child_process";
import { createServer, type Server } from "node:http";
import { expect } from "@jest/globals";
import { createTestManifest } from "../../testkit/dist/index.js";
import type { AtlasHostManifest, AtlasManifest } from "../../schema/dist/index.js";
import type { AtlasRuntimeOverrideDocument } from "../../runtime/dist/index.js";
import { CliArguments } from "../dist/arguments.js";
import { AtlasBuildService } from "../dist/build.js";
import { AtlasDevService, startControlServer, type AtlasDevOverrideDocument } from "../dist/dev.js";
import type { AtlasPrompter } from "../dist/ui.js";
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
    async listProjects() { return [defaultProject]; },
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
  const host = await startControlServer(app.port, localHostDocument(), "");
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
  const host = await startControlServer(0, localHostDocument(), "");
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

export function run(command: string, args: string[], options: SpawnOptions = {}): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "pipe", ...options });
    let stderr = "";
    let stdout = "";
    child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr)));
  });
}

export async function runDevService(
  root: string,
  projectRoot: string,
  values: string[],
  prompts: Pick<AtlasPrompter, "interactive" | "input" | "select"> = nonInteractivePrompts()
): Promise<string> {
  const project = { id: "orders", root: projectRoot, packageName: "orders", version: "1.0.0", outputPaths: [] };
  const workspace = createTestWorkspace({
    kind: "standalone",
    root,
    packageManager: "npm",
    findProject: async () => project,
    run: async () => {},
    spawn: () => {
      throw new Error("prepare-only test must not spawn a dev server");
    }
  });
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

export function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

export function listenWithRemoteEntry(): Promise<{ server: Server; port: number }> {
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

export async function availablePort(): Promise<number> {
  const { server, port } = await listenOnRandomPort(createServer());
  await closeServer(server);
  return port;
}

export function localDocument(hostId: string, manifest: AtlasManifest): AtlasRuntimeOverrideDocument {
  return {
    schemaVersion: "1",
    hostId,
    generatedAt: "2026-07-09T08:02:37.622Z",
    overrides: [{ appId: manifest.id, manifest, reason: "local" }]
  };
}

export async function catalogManifestIds(port: number, hostId: string): Promise<string[]> {
  const response = await fetch(`http://localhost:${port}/hosts/${hostId}/catalog.json`, { cache: "no-store" });
  expect(response.status).toBe(200);
  const catalog = await response.json();
  if (!hasManifestIds(catalog)) throw new Error("Control server returned an invalid catalog.");
  return Array.from(catalog.apps, (manifest) => manifest.id);
}

export async function devSessionHostId(port: number, hostId: string): Promise<string> {
  const response = await fetch(`http://localhost:${port}/atlas.dev-session.json?hostId=${encodeURIComponent(hostId)}`, { cache: "no-store" });
  expect(response.status).toBe(200);
  const session = await response.json();
  if (!hasStringProperty(session, "hostId")) throw new Error("Control server returned an invalid dev session.");
  return session.hostId;
}

export async function registryArtifactIds(port: number): Promise<{ hosts: string[]; apps: string[] }> {
  const response = await fetch(`http://localhost:${port}/registry.json`, { cache: "no-store" });
  expect(response.status).toBe(200);
  const registry = await response.json();
  if (!hasRegistryIds(registry)) throw new Error("Control server returned an invalid registry.");
  return {
    hosts: registry.hosts.map((manifest) => manifest.id),
    apps: registry.apps.map((manifest) => manifest.id)
  };
}

export function closeServer(server: Server): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

export function assertSingleComponentDeclaration(path: string, contents: string): void {
  const componentCount = angularComponentCount(contents) + reactComponentCount(contents);
  if (componentCount > 1) throw new Error(`${path} contains ${componentCount} component declarations`);
}

export function emptyRegistry() {
  return {
    schemaVersion: "1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    hosts: [],
    apps: [],
    selections: { hosts: {}, apps: {} }
  };
}

export function testTypeScriptConfig(compilerOptions: Record<string, unknown> = {}) {
  return {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      skipLibCheck: true,
      types: [],
      ...compilerOptions
    }
  };
}

function nonInteractivePrompts(): Pick<AtlasPrompter, "interactive" | "input" | "select"> {
  return {
    interactive: false,
    async input() { throw new Error("Unexpected interactive input prompt."); },
    async select() { throw new Error("Unexpected interactive selection prompt."); }
  };
}

function listenOnRandomPort(server: Server): Promise<{ server: Server; port: number }> {
  return new Promise<{ server: Server; port: number }>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "localhost", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a local port."));
        return;
      }
      resolve({ server, port: address.port });
    });
  });
}

function angularComponentCount(contents: string): number {
  return [...contents.matchAll(/@Component\s*\(/g)].length;
}

function reactComponentCount(contents: string): number {
  return [...contents.matchAll(/\bfunction\s+[A-Z][A-Za-z0-9_]*\s*\(/g)].length;
}

function hasStringProperty(value: unknown, property: string): value is Record<string, string> {
  if (typeof value !== "object" || value === null || !(property in value)) return false;
  return typeof Object.getOwnPropertyDescriptor(value, property)?.value === "string";
}

function hasManifestIds(value: unknown): value is { apps: Array<{ id: string }> } {
  return typeof value === "object" && value !== null && "apps" in value && Array.isArray(value.apps)
    && value.apps.every((manifest) => hasStringProperty(manifest, "id"));
}

function hasRegistryIds(value: unknown): value is { hosts: Array<{ id: string }>; apps: Array<{ id: string }> } {
  return typeof value === "object" && value !== null
    && "hosts" in value && Array.isArray(value.hosts) && value.hosts.every((manifest) => hasStringProperty(manifest, "id"))
    && "apps" in value && Array.isArray(value.apps) && value.apps.every((manifest) => hasStringProperty(manifest, "id"));
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

export function localHostDocument(): AtlasDevOverrideDocument {
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
    remoteEntryUrl: "http://localhost:4200/remoteEntry.json",
    exposes: { entry: "./host" },
    requiredLoaderApiVersion: "^1.0.0",
    createdAt: "2026-07-09T08:02:37.622Z"
  };
}

async function selectedHostId(port: number): Promise<string> {
  const response = await fetch(`http://localhost:${port}/hosts/mobile-host/catalog.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Control server returned ${response.status}.`);
  const catalog = await response.json() as { host?: { id?: unknown } };
  if (typeof catalog.host?.id !== "string") throw new Error("Control server returned invalid host catalog.");
  return catalog.host.id;
}
