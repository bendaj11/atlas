import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import type { AtlasRuntimeOverrideDocument } from "@atlas/runtime";
import type { AtlasConfig, AtlasHostCatalog, AtlasHostConfig } from "@atlas/schema";
import { CliArguments } from "./arguments.js";
import { AtlasBuildService } from "./build.js";
import { compileAtlasConfig } from "./config-compiler.js";
import { loadEnvFiles, saveWorkspaceLocalEnv } from "./env.js";
import { createHostRuntimeConfig } from "./runtime-config.js";
import type { AtlasPrompter } from "./ui.js";
import type { AtlasProject, AtlasWorkspace } from "./workspace.js";

const REMOTE_START_TIMEOUT_MS = 120_000;
const REMOTE_POLL_INTERVAL_MS = 200;
const LOOPBACK_HOST = "127.0.0.1";
interface DevControlServer {
  port: number;
  markReady(): Promise<void>;
  close(): Promise<void>;
}

interface DevTarget {
  hostId: string;
  hostUrl: string;
  promptedForConfiguration: boolean;
}

interface AtlasDevSessionDocument {
  schemaVersion: "1";
  hostId: string;
  catalog: AtlasHostCatalog;
  overrides: AtlasRuntimeOverrideDocument["overrides"];
  overrideUrl: string;
  generatedAt: string;
}

export class AtlasDevService {
  constructor(
    private readonly workspace: AtlasWorkspace,
    private readonly args: CliArguments,
    private readonly builds: Pick<AtlasBuildService, "loadConfig" | "buildManifest">
  ) {}

  async run(name: string, prompts: Pick<AtlasPrompter, "interactive" | "input" | "select"> = nonInteractivePrompter): Promise<void> {
    const project = await this.workspace.findProject(name);
    await loadEnvFiles(project.root);
    if (project.root !== this.workspace.root) await loadEnvFiles(this.workspace.root);
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
    await writeHostDevArtifacts(project, config, this.args);
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
    prompts: Pick<AtlasPrompter, "interactive" | "input" | "select">
  ): Promise<void> {
    const remotePort = await this.resolveRemotePort(project);
    const controlPort = this.args.port("control-port", 4400);
    const manifest = await this.builds.buildManifest(name, "local", { skipCompile: true, baseUrl: `http://localhost:${remotePort}` });
    const target = await this.resolveDevTarget(config, prompts);
    await this.offerToSaveDevTarget(project.root, target, prompts);
    const document: AtlasRuntimeOverrideDocument = {
      schemaVersion: "1", hostId: target.hostId,
      overrides: [{ appId: manifest.id, manifest, reason: "local" }],
      generatedAt: new Date().toISOString()
    };
    const directory = join(project.root, ".atlas");
    const overridePath = join(directory, "local-overrides.json");
    await mkdir(directory, { recursive: true });
    await writeFile(overridePath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
    const overrideUrl = `http://${LOOPBACK_HOST}:${controlPort}/atlas.local-overrides.json`;
    const hostActivationUrl = target.hostUrl;
    if (this.args.hasFlag("prepare-only")) {
      logHostViewUrl(hostActivationUrl);
      return;
    }
    const control = await startControlServer(controlPort, document, overrideUrl);
    const frameworkTask = this.workspace.kind === "nx" ? "serve" : "dev";
    const frameworkServer = this.workspace.spawn(project, frameworkTask, ["--port", String(remotePort)]);
    try {
      await waitForRemoteEntry(manifest.remoteEntryUrl, frameworkServer);
      await control.markReady();
      logHostViewUrl(hostActivationUrl);
      openBrowserWhenReady(this.args, hostActivationUrl);
    } catch (error) {
      if (!frameworkServer.killed) frameworkServer.kill("SIGTERM");
      await control.close();
      throw error;
    }
    await waitForShutdown(frameworkServer, control);
  }

  private async resolveRemotePort(project: AtlasProject): Promise<number> {
    if (this.args.hasFlag("port")) return this.args.port("port", 4201);
    return await readConfiguredDevServerPort(project.root, project.id) ?? 4201;
  }

  private async resolveDevTarget(config: AtlasConfig, prompts: Pick<AtlasPrompter, "interactive" | "input" | "select">): Promise<DevTarget> {
    const configuredHostId = this.args.flag("host") ?? process.env.ATLAS_HOST_ID;
    const configuredHostUrl = this.args.flag("host-url") ?? process.env.ATLAS_HOST_URL;
    const hostId = await this.resolveHostId(config, prompts);
    const hostUrl = await this.resolveHostUrl(config, hostId, prompts);
    return {
      hostId,
      hostUrl,
      promptedForConfiguration: prompts.interactive && (
        (!configuredHostId && configuredHostIds(config).length > 1) || !configuredHostUrl
      )
    };
  }

  private async offerToSaveDevTarget(
    projectRoot: string,
    target: DevTarget,
    prompts: Pick<AtlasPrompter, "interactive" | "select">
  ): Promise<void> {
    if (!target.promptedForConfiguration) return;
    const answer = await prompts.select("Save this host configuration to project .env.local?", [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" }
    ]);
    if (answer === "no") return;
    await saveWorkspaceLocalEnv(projectRoot, {
      ATLAS_HOST_ID: target.hostId,
      ATLAS_HOST_URL: target.hostUrl
    });
    console.info(`Saved local host configuration to ${join(projectRoot, ".env.local")}.`);
  }

  private async resolveHostId(config: AtlasConfig, prompts: Pick<AtlasPrompter, "interactive" | "select">): Promise<string> {
    const explicit = this.args.flag("host") ?? process.env.ATLAS_HOST_ID;
    if (explicit) return explicit;
    const hostIds = configuredHostIds(config);
    if (hostIds.length === 1) return hostIds[0]!;
    if (hostIds.length > 1 && prompts.interactive) {
      return prompts.select("Host receiving the local override", hostIds.map((hostId) => ({ label: hostId, value: hostId })));
    }
    if (hostIds.length > 1) throw new Error(`Multiple hosts found for "${config.id}". Pass --host or set ATLAS_HOST_ID.`);
    throw new Error(`No host configured for "${config.id}". Add a route or slot with hostId, or pass --host.`);
  }

  private async resolveHostUrl(
    config: AtlasConfig,
    hostId: string,
    prompts: Pick<AtlasPrompter, "interactive" | "input" | "select">
  ): Promise<string> {
    const configuredUrl = this.args.flag("host-url") ?? process.env.ATLAS_HOST_URL;
    const hostUrl = configuredUrl ?? await this.promptForHostUrl(prompts);
    if (!isBaseHostUrl(hostUrl)) return hostUrl;
    const basePaths = routeBasePaths(config, hostId);
    if (basePaths.length === 0) return hostUrl;
    if (basePaths.length === 1) return urlWithBasePath(hostUrl, basePaths[0]!);
    if (!prompts.interactive) {
      throw new Error(`Multiple routes found for host "${hostId}". Pass a full --host-url or set ATLAS_HOST_URL to a full URL.`);
    }
    const basePath = await prompts.select("Route opened for local development", basePaths.map((value) => ({ label: value, value })));
    return urlWithBasePath(hostUrl, basePath);
  }

  private async promptForHostUrl(prompts: Pick<AtlasPrompter, "interactive" | "input">): Promise<string> {
    if (prompts.interactive) return prompts.input("Host URL for local development");
    throw new Error("Host URL is required. Pass --host-url or set ATLAS_HOST_URL.");
  }
}

async function writeHostDevArtifacts(
  project: AtlasProject,
  config: AtlasHostConfig,
  args: CliArguments
): Promise<void> {
  const publicDirectory = join(project.root, "public");
  await mkdir(publicDirectory, { recursive: true });
  const runtimeConfigPath = join(publicDirectory, "atlas.runtime.json");
  const runtimeConfig = createHostRuntimeConfig(config, args, project.version);
  await writeFile(runtimeConfigPath, `${JSON.stringify(runtimeConfig, null, 2)}\n`, "utf8");
  if (config.framework === "react") {
    const federationInfo = { name: federationRemoteName(config.id), exposes: [], shared: [] };
    await writeFile(join(publicDirectory, "remoteEntry.json"), `${JSON.stringify(federationInfo, null, 2)}\n`, "utf8");
  }
}

function federationRemoteName(id: string): string {
  return `atlas_${id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

export async function startControlServer(
  port: number,
  document: AtlasRuntimeOverrideDocument,
  overrideUrl: string
): Promise<DevControlServer> {
  try {
    return await startOwnedControlServer(port, document, overrideUrl);
  } catch (error) {
    if (!isAddressInUse(error)) throw error;
    return joinControlServer(port, document);
  }
}

function startOwnedControlServer(port: number, document: AtlasRuntimeOverrideDocument, overrideUrl: string): Promise<DevControlServer> {
  const session = createDevSessionStore(document, overrideUrl);
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const pathname = requestUrl.pathname;
    const requestedHostId = requestUrl.searchParams.get("hostId") ?? undefined;
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("access-control-allow-private-network", "true");
    response.setHeader("cache-control", "no-store");
    if (request.method === "OPTIONS") {
      response.writeHead(204, { "access-control-allow-methods": "GET, POST, DELETE, OPTIONS" }); response.end(); return;
    }
    if (request.method === "POST" && pathname === "/atlas.dev-session/overrides") {
      readJsonRequest<AtlasRuntimeOverrideDocument>(request)
        .then((nextDocument) => {
          session.register(nextDocument);
          writeJson(response, { status: "registered", overrideUrl });
        })
        .catch((error: unknown) => writeError(response, error));
      return;
    }
    const overrideReadyMatch = /^\/atlas\.dev-session\/overrides\/([^/]+)\/ready$/.exec(pathname);
    if (request.method === "POST" && overrideReadyMatch?.[1]) {
      session.markReady(decodeURIComponent(overrideReadyMatch[1]), requestedHostId);
      writeJson(response, { status: "ready" });
      return;
    }
    const overrideMatch = /^\/atlas\.dev-session\/overrides\/([^/]+)$/.exec(pathname);
    if (request.method === "DELETE" && overrideMatch?.[1]) {
      session.unregister(decodeURIComponent(overrideMatch[1]), requestedHostId);
      writeJson(response, { status: "removed" });
      return;
    }
    if (request.method === "GET" && pathname === "/atlas.local-overrides.json") {
      const current = session.document(requestedHostId);
      if (!current) {
        response.writeHead(503, { "content-type": "application/json; charset=utf-8", "retry-after": "1" });
        response.end('{"status":"starting"}\n');
        return;
      }
      writeJson(response, current);
      return;
    }
    if (request.method === "GET" && pathname === "/atlas.dev-session.json") {
      const current = session.devSession(requestedHostId);
      if (!current) {
        response.writeHead(503, { "content-type": "application/json; charset=utf-8", "retry-after": "1" });
        response.end('{"status":"starting"}\n');
        return;
      }
      writeJson(response, current);
      return;
    }
    const catalogMatch = /^\/hosts\/([^/]+)\/catalog\.json$/.exec(pathname);
    if (request.method === "GET" && catalogMatch?.[1]) {
      const current = session.catalog(decodeURIComponent(catalogMatch[1]));
      if (!current) {
        response.writeHead(503, { "content-type": "application/json; charset=utf-8", "retry-after": "1" });
        response.end('{"status":"starting"}\n');
        return;
      }
      writeJson(response, current);
      return;
    }
    if (request.method === "GET" && pathname === "/health") {
      const ready = session.hasReadySession();
      writeJson(response, ready ? { status: "ok" } : { status: "starting" }, ready ? 200 : 503);
      return;
    }
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); response.end("Not found\n");
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, LOOPBACK_HOST, () => {
      server.off("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Atlas dev control server did not receive a TCP port."));
        return;
      }
      resolve({
        port: address.port,
        async markReady() {
          session.markDocumentReady(document);
        },
        close() {
          return closeServer(server);
        }
      });
    });
  });
}

async function joinControlServer(
  port: number,
  document: AtlasRuntimeOverrideDocument
): Promise<DevControlServer> {
  const baseUrl = `http://${LOOPBACK_HOST}:${port}`;
  await postJson(`${baseUrl}/atlas.dev-session/overrides`, document);
  const appIds = document.overrides.map((override) => override.manifest.id);
  const hostQuery = `?hostId=${encodeURIComponent(document.hostId)}`;
  return {
    port,
    async markReady() {
      await Promise.all(appIds.map((appId) => postJson(`${baseUrl}/atlas.dev-session/overrides/${encodeURIComponent(appId)}/ready${hostQuery}`, {})));
    },
    async close() {
      await Promise.all(appIds.map((appId) => deleteJson(`${baseUrl}/atlas.dev-session/overrides/${encodeURIComponent(appId)}${hostQuery}`)));
    }
  };
}

export function createLocalDevCatalog(document: AtlasRuntimeOverrideDocument): AtlasHostCatalog {
  return {
    schemaVersion: "1",
    hostId: document.hostId,
    generatedAt: document.generatedAt,
    manifests: uniqueManifests(document.overrides)
  };
}

function uniqueManifests(overrides: AtlasRuntimeOverrideDocument["overrides"]): AtlasHostCatalog["manifests"] {
  return [...new Map(overrides.map((override) => [override.manifest.id, override.manifest])).values()];
}

export function createDevSession(
  document: AtlasRuntimeOverrideDocument,
  catalog: AtlasHostCatalog,
  overrideUrl: string
): AtlasDevSessionDocument {
  return {
    schemaVersion: "1",
    hostId: document.hostId,
    catalog,
    overrides: document.overrides,
    overrideUrl,
    generatedAt: document.generatedAt
  };
}

interface DevSessionEntry {
  override: AtlasRuntimeOverrideDocument["overrides"][number];
  ready: boolean;
}

interface DevSessionStore {
  register(document: AtlasRuntimeOverrideDocument): void;
  unregister(appId: string, hostId?: string): void;
  markReady(appId: string, hostId?: string): void;
  markDocumentReady(document: AtlasRuntimeOverrideDocument): void;
  document(hostId?: string): AtlasRuntimeOverrideDocument | undefined;
  catalog(hostId: string): AtlasHostCatalog | undefined;
  devSession(hostId?: string): AtlasDevSessionDocument | undefined;
  hasReadySession(): boolean;
}

function createDevSessionStore(initial: AtlasRuntimeOverrideDocument, overrideUrl: string): DevSessionStore {
  const hosts = new Map<string, HostDevSession>();
  register(initial);

  function register(document: AtlasRuntimeOverrideDocument): void {
    const host = hosts.get(document.hostId) ?? createHostDevSession(document.generatedAt);
    host.generatedAt = document.generatedAt;
    for (const override of document.overrides) host.entries.set(override.manifest.id, { override, ready: false });
    hosts.set(document.hostId, host);
  }

  function currentDocument(requestedHostId?: string): AtlasRuntimeOverrideDocument | undefined {
    const hostId = resolveHostId(hosts, requestedHostId);
    if (!hostId) return undefined;
    const host = hosts.get(hostId);
    if (!host) return undefined;
    const overrides = [...host.entries.values()].filter((entry) => entry.ready).map((entry) => entry.override);
    if (overrides.length === 0) return undefined;
    return { schemaVersion: "1", hostId, overrides, generatedAt: host.generatedAt };
  }

  function matchingHosts(appId: string, requestedHostId?: string): HostDevSession[] {
    if (requestedHostId) {
      const host = hosts.get(requestedHostId);
      return host ? [host] : [];
    }
    return [...hosts.values()].filter((host) => host.entries.has(appId));
  }

  function markReady(appId: string, requestedHostId?: string): void {
    for (const host of matchingHosts(appId, requestedHostId)) {
      const entry = host.entries.get(appId);
      if (entry) entry.ready = true;
    }
  }

  return {
    register,
    unregister(appId, requestedHostId) {
      for (const [hostId, host] of hosts) {
        if (requestedHostId && requestedHostId !== hostId) continue;
        host.entries.delete(appId);
        if (host.entries.size === 0) hosts.delete(hostId);
      }
    },
    markReady,
    markDocumentReady(document) {
      for (const override of document.overrides) markReady(override.appId, document.hostId);
    },
    document: currentDocument,
    catalog(hostId) {
      const document = currentDocument(hostId);
      return document ? createLocalDevCatalog(document) : undefined;
    },
    devSession(hostId) {
      const document = currentDocument(hostId);
      if (!document) return undefined;
      return createDevSession(document, createLocalDevCatalog(document), overrideUrl);
    },
    hasReadySession() {
      return [...hosts.keys()].some((hostId) => currentDocument(hostId) !== undefined);
    }
  };
}

interface HostDevSession {
  entries: Map<string, DevSessionEntry>;
  generatedAt: string;
}

function createHostDevSession(generatedAt: string): HostDevSession {
  return { entries: new Map<string, DevSessionEntry>(), generatedAt };
}

function resolveHostId(hosts: Map<string, HostDevSession>, requestedHostId?: string): string | undefined {
  if (requestedHostId) return requestedHostId;
  if (hosts.size !== 1) return undefined;
  return hosts.keys().next().value;
}

function isAddressInUse(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EADDRINUSE";
}

function readJsonRequest<T>(request: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.once("error", reject);
    request.once("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as T);
      } catch {
        reject(new Error("Invalid JSON request body."));
      }
    });
  });
}

function writeJson(response: ServerResponse, value: unknown, status = 200): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}

function writeError(response: ServerResponse, error: unknown): void {
  writeJson(response, { error: error instanceof Error ? error.message : "Atlas dev control request failed." }, 400);
}

async function postJson(url: string, value: unknown): Promise<void> {
  await fetchControl(url, { method: "POST", body: JSON.stringify(value) });
}

async function deleteJson(url: string): Promise<void> {
  await fetchControl(url, { method: "DELETE" });
}

async function fetchControl(url: string, init: RequestInit): Promise<void> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers }
  });
  if (response.ok) return;
  throw new Error(`Atlas dev control server rejected ${url}: ${response.status} ${await response.text()}`);
}

function closeServer(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
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

function waitForShutdown(child: ChildProcess, control: DevControlServer): Promise<void> {
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
    const closeControlServer = async (): Promise<void> => {
      try {
        await control.close();
        serverClosed = true;
        resolveAfterShutdown();
      } catch (error) {
        if (settled) return;
        settled = true;
        removeSignalListeners();
        reject(error);
      }
    };
    const stop = (): void => {
      if (stopping) return;
      stopping = true;
      if (!child.killed) child.kill("SIGTERM");
      void closeControlServer();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      removeSignalListeners();
      void control.close();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      childExited = true;
      void closeControlServer();
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

function logHostViewUrl(url: string | undefined): void {
  if (url) {
    console.info(`App Preview: ${url}`);
  } else {
    console.info("App Preview: unresolved; pass --host-url or set ATLAS_HOST_URL.");
  }
}

function openBrowserWhenReady(args: CliArguments, url: string | undefined): void {
  if (!url || args.hasFlag("no-open")) return;
  const command = browserOpenCommand(url);
  try {
    const child = spawn(command.command, command.args, { detached: true, stdio: "ignore" });
    child.once("error", () => undefined);
    child.unref();
  } catch {
    // The logged URL remains the fallback when the platform opener is unavailable.
  }
}

export function browserOpenCommand(url: string, platform: NodeJS.Platform = process.platform): { command: string; args: string[] } {
  if (platform === "darwin") return { command: "osascript", args: ["-l", "JavaScript", "-e", MACOS_FOCUS_BROWSER_TAB_SCRIPT, "--", url] };
  if (platform === "win32") {
    return {
      command: "powershell.exe",
      args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", WINDOWS_FOCUS_BROWSER_TAB_SCRIPT, url]
    };
  }
  return { command: "xdg-open", args: [url] };
}

const WINDOWS_FOCUS_BROWSER_TAB_SCRIPT = String.raw`
$targetUrl = $args[0]
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class AtlasWindow {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr handle);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr handle, int command);
}
'@

$browserProcesses = Get-Process chrome, msedge, brave, firefox -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 }
$tabCondition = New-Object Windows.Automation.PropertyCondition(
  [Windows.Automation.AutomationElement]::ControlTypeProperty,
  [Windows.Automation.ControlType]::TabItem
)
$editCondition = New-Object Windows.Automation.PropertyCondition(
  [Windows.Automation.AutomationElement]::ControlTypeProperty,
  [Windows.Automation.ControlType]::Edit
)

foreach ($process in $browserProcesses) {
  try {
    $window = [Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
    $tabs = $window.FindAll([Windows.Automation.TreeScope]::Descendants, $tabCondition)
    foreach ($tab in $tabs) {
      $selection = $tab.GetCurrentPattern([Windows.Automation.SelectionItemPattern]::Pattern)
      $selection.Select()
      Start-Sleep -Milliseconds 40
      $edits = $window.FindAll([Windows.Automation.TreeScope]::Descendants, $editCondition)
      foreach ($edit in $edits) {
        $valuePattern = $null
        if (-not $edit.TryGetCurrentPattern([Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern)) { continue }
        if ($valuePattern.Current.Value -ne $targetUrl) { continue }
        [AtlasWindow]::ShowWindowAsync($process.MainWindowHandle, 9) | Out-Null
        [AtlasWindow]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
        exit 0
      }
    }
  } catch {}
}

Start-Process $targetUrl
`;

const MACOS_FOCUS_BROWSER_TAB_SCRIPT = String.raw`
function run(argv) {
  const requestedUrl = argv[0];
  const browsers = [
    { name: "Safari", safari: true },
    { name: "Google Chrome" },
    { name: "Brave Browser" },
    { name: "Microsoft Edge" },
    { name: "Chromium" }
  ];

  for (const candidate of browsers) {
    const browser = Application(candidate.name);
    if (!browser.running()) continue;
    try {
      const windows = browser.windows();
      for (let windowIndex = 0; windowIndex < windows.length; windowIndex += 1) {
        const tabs = windows[windowIndex].tabs();
        for (let tabIndex = 0; tabIndex < tabs.length; tabIndex += 1) {
          if (tabs[tabIndex].url() !== requestedUrl) continue;
          if (candidate.safari) windows[windowIndex].currentTab = tabs[tabIndex];
          else windows[windowIndex].activeTabIndex = tabIndex + 1;
          windows[windowIndex].index = 1;
          browser.activate();
          return;
        }
      }
    } catch (_) {}
  }

  const app = Application.currentApplication();
  app.includeStandardAdditions = true;
  app.doShellScript("open " + quotedForm(requestedUrl));
}

function quotedForm(value) {
  return "'" + value.replace(/'/g, "'\\\"'\\\"'") + "'";
}
`;

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

function routeBasePaths(config: AtlasConfig, hostId: string): string[] {
  if (isHostConfig(config)) return [];
  return config.routes?.filter((route) => route.hostId === hostId).map((route) => route.basePath) ?? [];
}

function isBaseHostUrl(value: string): boolean {
  const url = new URL(value);
  return url.pathname === "/" && !url.search && !url.hash;
}

function urlWithBasePath(hostUrl: string, basePath: string): string {
  return `${hostUrl.replace(/\/$/, "")}${basePath}`;
}

async function readConfiguredDevServerPort(projectRoot: string, projectName: string): Promise<number | undefined> {
  const angularWorkspace = await readJsonFile<Record<string, unknown>>(join(projectRoot, "angular.json"));
  const angularPort = readAngularProjectPort(angularWorkspace, projectName);
  if (angularPort !== undefined) return angularPort;

  const nxProject = await readJsonFile<Record<string, unknown>>(join(projectRoot, "project.json"));
  const nxPort = readPortFromTargets(asObject(nxProject?.targets));
  if (nxPort !== undefined) return nxPort;

  return await readViteDevServerPort(projectRoot);
}

function readAngularProjectPort(workspace: Record<string, unknown> | undefined, projectName: string): number | undefined {
  const projects = asObject(workspace?.projects);
  const project = objectValue(projects[projectName]) ?? firstObjectValue(projects);
  return readPortFromTargets(asObject(project?.architect ?? project?.targets));
}

function readPortFromTargets(targets: Record<string, unknown>): number | undefined {
  return readTargetPort(targets.serve) ?? readTargetPort(targets["serve-original"]);
}

function readTargetPort(target: unknown): number | undefined {
  const port = asObject(asObject(target).options).port;
  return typeof port === "number" ? parsePort(port) : undefined;
}

async function readViteDevServerPort(projectRoot: string): Promise<number | undefined> {
  try {
    const source = await readFile(join(projectRoot, "vite.config.ts"), "utf8");
    const match = /\bserver\s*:\s*\{[^}]*\bport\s*:\s*(\d{1,5})\b/s.exec(source);
    return match?.[1] ? parsePort(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

function parsePort(value: string | number): number | undefined {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : undefined;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function firstObjectValue(value: Record<string, unknown>): Record<string, unknown> | undefined {
  return Object.values(value).find((entry): entry is Record<string, unknown> => objectValue(entry) !== undefined);
}

async function readJsonFile<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return undefined;
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

const nonInteractivePrompter: Pick<AtlasPrompter, "interactive" | "input" | "select"> = {
  interactive: false,
  async input() {
    throw new Error("Host URL must be provided in non-interactive mode.");
  },
  async select() {
    throw new Error("Host must be provided in non-interactive mode.");
  }
};
