import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { dirname, join } from "node:path";
import type { AtlasRuntimeOverrideDocument } from "@atlas/runtime";
import type { AtlasConfig, AtlasHostConfig } from "@atlas/schema";
import { CliArguments } from "./arguments.js";
import { AtlasBuildService } from "./build.js";
import { compileAtlasConfig } from "./config-compiler.js";
import type { AtlasPrompter } from "./ui.js";
import type { AtlasProject, AtlasWorkspace } from "./workspace.js";

const REMOTE_START_TIMEOUT_MS = 120_000;
const REMOTE_POLL_INTERVAL_MS = 200;
const DEFAULT_HOST_ORIGINS = {
  angular: "http://localhost:4200",
  react: "http://localhost:5173"
} as const;

interface DevControlServer {
  server: Server;
  markReady(): void;
}

interface DevTarget {
  hostId: string;
  basePath?: string;
  hostUrl?: string;
}

export class AtlasDevService {
  constructor(
    private readonly workspace: AtlasWorkspace,
    private readonly args: CliArguments,
    private readonly builds: AtlasBuildService
  ) {}

  async run(name: string, prompts: Pick<AtlasPrompter, "interactive" | "select"> = nonInteractivePrompter): Promise<void> {
    const project = await this.workspace.findProject(name);
    await compileAtlasConfig(this.workspace, project);
    const config = await this.builds.loadConfig(project.root);
    if (config.framework === "angular" && !this.args.hasFlag("prepare-only")) {
      await assertUsableAngularBuildPackage(this.workspace.root, project.root);
    }
    if (isHostConfig(config)) {
      await this.runHost(project, config);
      return;
    }
    await this.runApp(project, name, config, prompts);
  }

  private async runHost(project: AtlasProject, config: AtlasHostConfig): Promise<void> {
    if (this.args.hasFlag("prepare-only")) {
      console.info(`Host "${config.id}" is ready. Run without --prepare-only to start its dev server.`);
      return;
    }
    const hostServer = this.workspace.spawn(project, "dev");
    console.info(`Atlas is running host ${config.id}. Press Ctrl+C to stop.`);
    await waitForChildShutdown(hostServer, "Host dev server");
  }

  private async runApp(
    project: AtlasProject,
    name: string,
    config: AtlasConfig,
    prompts: Pick<AtlasPrompter, "interactive" | "select">
  ): Promise<void> {
    const remotePort = this.args.port("port", 4201);
    const controlPort = this.args.port("control-port", 4400);
    const manifest = await this.builds.buildManifest(name, "local", { skipCompile: true, baseUrl: `http://localhost:${remotePort}` });
    const target = await this.resolveDevTarget(config, prompts);
    const document: AtlasRuntimeOverrideDocument = {
      schemaVersion: "1", hostId: target.hostId,
      overrides: [{ mfId: manifest.id, manifest, reason: "local" }],
      generatedAt: new Date().toISOString()
    };
    const directory = join(project.root, ".atlas");
    const overridePath = join(directory, "local-overrides.json");
    await mkdir(directory, { recursive: true });
    await writeFile(overridePath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
    const overrideUrl = `http://localhost:${controlPort}/atlas.local-overrides.json`;
    const hostActivationUrl = target.hostUrl ? activationUrl(target.hostUrl, overrideUrl) : undefined;
    logHostViewUrl(hostActivationUrl);
    if (this.args.hasFlag("prepare-only")) return;
    const control = await startControlServer(controlPort, document);
    const frameworkServer = this.workspace.spawn(project, "dev", ["--port", String(remotePort)]);
    try {
      await waitForRemoteEntry(manifest.remoteEntryUrl, frameworkServer);
      control.markReady();
      openBrowserWhenReady(this.args, hostActivationUrl);
    } catch (error) {
      if (!frameworkServer.killed) frameworkServer.kill("SIGTERM");
      control.server.close();
      throw error;
    }
    await waitForShutdown(frameworkServer, control.server);
  }

  private async resolveDevTarget(config: AtlasConfig, prompts: Pick<AtlasPrompter, "interactive" | "select">): Promise<DevTarget> {
    const hostId = await this.resolveHostId(config, prompts);
    const basePath = routeBasePath(config, hostId);
    const hostUrl = await this.resolveHostUrl(hostId, basePath);
    return {
      hostId,
      ...(basePath ? { basePath } : {}),
      ...(hostUrl ? { hostUrl } : {})
    };
  }

  private async resolveHostId(config: AtlasConfig, prompts: Pick<AtlasPrompter, "interactive" | "select">): Promise<string> {
    const explicit = this.args.flag("host") ?? process.env.ATLAS_HOST;
    if (explicit) return explicit;
    const hostIds = configuredHostIds(config);
    if (hostIds.length === 1) return hostIds[0]!;
    if (hostIds.length > 1 && prompts.interactive) {
      return prompts.select("Host receiving the local override", hostIds.map((hostId) => ({ label: hostId, value: hostId })));
    }
    if (hostIds.length > 1) throw new Error(`Multiple hosts found for "${config.id}". Pass --host or set ATLAS_HOST.`);
    return "host";
  }

  private async resolveHostUrl(hostId: string, basePath: string | undefined): Promise<string | undefined> {
    return this.args.flag("host-url") ??
      process.env.ATLAS_HOST_URL ??
      urlFromOrigin(process.env.ATLAS_HOST_ORIGIN, basePath) ??
      await this.defaultHostUrl(hostId, basePath);
  }

  private async defaultHostUrl(hostId: string, basePath: string | undefined): Promise<string | undefined> {
    try {
      const hostProject = await this.workspace.findProject(hostId);
      await compileAtlasConfig(this.workspace, hostProject);
      const hostConfig = await this.builds.loadConfig(hostProject.root);
      if (!isHostConfig(hostConfig)) return undefined;
      return urlFromOrigin(defaultHostOrigin(hostConfig), basePath);
    } catch {
      return undefined;
    }
  }
}

function startControlServer(port: number, document: AtlasRuntimeOverrideDocument): Promise<DevControlServer> {
  let ready = false;
  const server = createServer((request, response) => {
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("access-control-allow-private-network", "true");
    response.setHeader("cache-control", "no-store");
    if (request.method === "OPTIONS") {
      response.writeHead(204, { "access-control-allow-methods": "GET, OPTIONS" }); response.end(); return;
    }
    if (request.method === "GET" && request.url === "/atlas.local-overrides.json") {
      if (!ready) {
        response.writeHead(503, { "content-type": "application/json; charset=utf-8", "retry-after": "1" });
        response.end('{"status":"starting"}\n');
        return;
      }
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" }); response.end(`${JSON.stringify(document, null, 2)}\n`); return;
    }
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(ready ? 200 : 503, { "content-type": "application/json; charset=utf-8" });
      response.end(ready ? '{"status":"ok"}\n' : '{"status":"starting"}\n');
      return;
    }
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); response.end("Not found\n");
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve({ server, markReady: () => { ready = true; } }));
  });
}

async function waitForRemoteEntry(remoteEntryUrl: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + REMOTE_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Framework dev server exited before ${remoteEntryUrl} became available.`);
    }
    try {
      const response = await fetch(remoteEntryUrl, { cache: "no-store" });
      if (await remoteEntryIsReady(response)) return;
    } catch {
      // The framework server has not opened its port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, REMOTE_POLL_INTERVAL_MS));
  }
  throw new Error(`Framework dev server did not serve ${remoteEntryUrl} within 120 seconds.`);
}

export async function remoteEntryIsReady(response: Response): Promise<boolean> {
  if (!response.ok) return false;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return false;
  try {
    const metadata = await response.json() as { name?: unknown; exposes?: unknown };
    return typeof metadata.name === "string" && Array.isArray(metadata.exposes);
  } catch {
    return false;
  }
}

function waitForShutdown(child: ChildProcess, server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    let stopping = false;
    let childExited = false;
    let serverClosed = false;
    let settled = false;

    const removeSignalListeners = (): void => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
    };
    const resolveAfterShutdown = (): void => {
      if (settled || !childExited || !serverClosed) return;
      settled = true;
      removeSignalListeners();
      resolve();
    };
    const closeControlServer = (): void => {
      if (!server.listening) {
        serverClosed = true;
        resolveAfterShutdown();
        return;
      }
      server.close(() => {
        serverClosed = true;
        resolveAfterShutdown();
      });
    };
    const stop = (): void => {
      if (stopping) return;
      stopping = true;
      if (!child.killed) child.kill("SIGTERM");
      closeControlServer();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      removeSignalListeners();
      server.close();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      childExited = true;
      closeControlServer();
      if (stopping || code === 0 || signal === "SIGTERM") {
        resolveAfterShutdown();
        return;
      }
      if (settled) return;
      settled = true;
      removeSignalListeners();
      reject(new Error(`Framework dev server exited with code ${code ?? "unknown"}.`));
    });
  });
}

function waitForChildShutdown(child: ChildProcess, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let stopping = false;
    let settled = false;
    const removeSignalListeners = (): void => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
    };
    const stop = (): void => {
      stopping = true;
      if (!child.killed) child.kill("SIGTERM");
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      removeSignalListeners();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      removeSignalListeners();
      if (stopping || code === 0 || signal === "SIGTERM") resolve();
      else reject(new Error(`${label} exited with code ${code ?? "unknown"}.`));
    });
  });
}

function activationUrl(hostUrl: string, overrideUrl: string): string {
  const url = new URL(hostUrl);
  url.searchParams.set("atlas-override", overrideUrl);
  return url.toString();
}

function logHostViewUrl(url: string | undefined): void {
  if (url) {
    console.info(`View app: ${url}`);
  } else {
    console.info("View app: unresolved; pass --host-url or set ATLAS_HOST_ORIGIN.");
  }
}

function openBrowserWhenReady(args: CliArguments, url: string | undefined): void {
  if (!url || args.hasFlag("no-open") || !process.stdout.isTTY) return;
  const command = browserOpenCommand(url);
  try {
    const child = spawn(command.command, command.args, { detached: true, stdio: "ignore" });
    child.once("error", () => undefined);
    child.unref();
  } catch {
    // The logged URL remains the fallback when the platform opener is unavailable.
  }
}

function browserOpenCommand(url: string): { command: string; args: string[] } {
  if (process.platform === "darwin") return { command: "open", args: [url] };
  if (process.platform === "win32") return { command: "cmd", args: ["/c", "start", "", url] };
  return { command: "xdg-open", args: [url] };
}

function isHostConfig(config: AtlasConfig): config is AtlasHostConfig {
  return "allowAppOverrides" in config || "resourcesTimeoutMs" in config || "resourcesRetryCount" in config;
}

interface CorruptAngularBuildPackage {
  version: string;
  sourcePath: string;
}

async function assertUsableAngularBuildPackage(workspaceRoot: string, projectRoot: string): Promise<void> {
  const corruptPackage = await findCorruptAngularBuildPackage(projectRoot) ?? await findCorruptAngularBuildPackage(workspaceRoot);
  if (!corruptPackage) return;

  throw new Error([
    `Angular dev server cannot start because @angular/build ${corruptPackage.version} is corrupt.`,
    `${corruptPackage.sourcePath} calls creadConfiguration(...), but @angular/compiler-cli exports readConfiguration.`,
    "Pin Angular build tooling to a fixed patch, reinstall node_modules, then run atlas dev again."
  ].join(" "));
}

async function findCorruptAngularBuildPackage(root: string): Promise<CorruptAngularBuildPackage | undefined> {
  try {
    const requireFromRoot = createRequire(join(root, "package.json"));
    const packagePath = requireFromRoot.resolve("@angular/build/package.json");
    const packageJson = JSON.parse(await readFile(packagePath, "utf8")) as { version?: unknown };
    const sourcePath = join(dirname(packagePath), "src/tools/angular/compilation/angular-compilation.js");
    const source = await readFile(sourcePath, "utf8");
    if (!source.includes("creadConfiguration(")) return undefined;
    return {
      version: typeof packageJson.version === "string" ? packageJson.version : "unknown",
      sourcePath
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "MODULE_NOT_FOUND") return undefined;
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

function configuredHostIds(config: AtlasConfig): string[] {
  if (isHostConfig(config)) return [];
  return [...new Set([
    ...(config.routes ?? []).map((route) => route.hostId),
    ...(config.slots ?? []).map((slot) => slot.hostId)
  ])].filter((hostId) => hostId !== "*");
}

function routeBasePath(config: AtlasConfig, hostId: string): string | undefined {
  if (isHostConfig(config)) return undefined;
  return config.routes?.find((route) => route.hostId === hostId)?.basePath;
}

function urlFromOrigin(origin: string | undefined, basePath: string | undefined): string | undefined {
  if (!origin) return undefined;
  return `${origin.replace(/\/$/, "")}${basePath ?? ""}`;
}

function defaultHostOrigin(config: AtlasHostConfig): string | undefined {
  if (config.framework === "angular" || config.framework === "react") return DEFAULT_HOST_ORIGINS[config.framework];
  return undefined;
}

const nonInteractivePrompter: Pick<AtlasPrompter, "interactive" | "select"> = {
  interactive: false,
  async select() {
    throw new Error("Host must be provided in non-interactive mode.");
  }
};
