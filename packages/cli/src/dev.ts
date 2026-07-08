import type { ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import type { AtlasRuntimeOverrideDocument } from "@atlas/runtime";
import { CliArguments } from "./arguments.js";
import { AtlasBuildService } from "./build.js";
import type { AtlasWorkspace } from "./workspace.js";

const REMOTE_START_TIMEOUT_MS = 120_000;
const REMOTE_POLL_INTERVAL_MS = 200;

interface DevControlServer {
  server: Server;
  markReady(): void;
}

export class AtlasDevService {
  constructor(
    private readonly workspace: AtlasWorkspace,
    private readonly args: CliArguments,
    private readonly builds: AtlasBuildService
  ) {}

  async run(name: string): Promise<void> {
    const project = await this.workspace.findProject(name);
    const remotePort = this.args.port("port", 4201);
    const controlPort = this.args.port("control-port", 4400);
    await this.workspace.run(project, "atlas:config");
    const manifest = await this.builds.buildManifest(name, "local", { skipCompile: true, baseUrl: `http://localhost:${remotePort}` });
    const hostId = this.args.flag("host") ?? manifest.supportedHosts[0] ?? "host";
    const document: AtlasRuntimeOverrideDocument = {
      schemaVersion: "1", hostId,
      overrides: [{ mfId: manifest.id, manifest, reason: "local" }],
      generatedAt: new Date().toISOString()
    };
    const directory = join(project.root, ".atlas");
    const overridePath = join(directory, "local-overrides.json");
    await mkdir(directory, { recursive: true });
    await writeFile(overridePath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
    const overrideUrl = `http://localhost:${controlPort}/atlas.local-overrides.json`;
    const hostUrl = this.args.flag("host-url");
    console.info(`Local override written to ${overridePath}.`);
    console.info(`Override URL: ${overrideUrl}`);
    if (hostUrl) console.info(`Open host: ${activationUrl(hostUrl, overrideUrl)}`);
    if (this.args.hasFlag("prepare-only")) return;
    const control = await startControlServer(controlPort, document);
    const frameworkServer = this.workspace.spawn(project, "dev", ["--port", String(remotePort)]);
    try {
      await waitForRemoteEntry(manifest.remoteEntryUrl, frameworkServer);
      control.markReady();
    } catch (error) {
      if (!frameworkServer.killed) frameworkServer.kill("SIGTERM");
      control.server.close();
      throw error;
    }
    console.info(`Atlas is serving ${manifest.id} for host ${hostId}. Press Ctrl+C to stop.`);
    await waitForShutdown(frameworkServer, control.server);
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
      if (response.ok) return;
    } catch {
      // The framework server has not opened its port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, REMOTE_POLL_INTERVAL_MS));
  }
  throw new Error(`Framework dev server did not serve ${remoteEntryUrl} within 120 seconds.`);
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

function activationUrl(hostUrl: string, overrideUrl: string): string {
  const url = new URL(hostUrl);
  url.searchParams.set("atlas-override", overrideUrl);
  return url.toString();
}
