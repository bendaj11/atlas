import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AtlasConfig, AtlasHostRuntimeConfig } from "@atlas/schema";
import { CliArguments } from "./arguments.js";
import { AtlasBuildService } from "./build.js";
import type { AtlasWorkspace } from "./workspace.js";

export class AtlasRuntimeConfigService {
  constructor(
    private readonly workspace: AtlasWorkspace,
    private readonly args: CliArguments,
    private readonly builds: AtlasBuildService
  ) {}

  async generate(name: string): Promise<{ path: string; config: AtlasHostRuntimeConfig }> {
    const project = await this.workspace.findProject(name);
    if (!this.args.hasFlag("skip-compile")) await this.workspace.run(project, "atlas:config");
    const source = await this.builds.loadConfig(project.root);
    const config = createHostRuntimeConfig(source);
    const output = resolve(this.args.flag("out") ?? `${project.root}/public/atlas.runtime.json`);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    return { path: output, config };
  }
}

export function createHostRuntimeConfig(config: AtlasConfig): AtlasHostRuntimeConfig {
  const runtime = config.runtime ?? {};
  return {
    schemaVersion: "1",
    hostId: config.id,
    catalogUrl: runtime.catalogUrl ?? config.catalogUrl ?? `http://localhost:4400/hosts/${config.id}/catalog.json`,
    requireIntegrity: runtime.requireIntegrity ?? true,
    allowRuntimeOverrides: runtime.allowRuntimeOverrides ?? true,
    requestTimeoutMs: runtime.requestTimeoutMs ?? 10000,
    retryAttempts: runtime.retryAttempts ?? 2,
    retryDelayMs: runtime.retryDelayMs ?? 250,
    loadTimeoutMs: runtime.loadTimeoutMs ?? 15000,
    waitForMfReady: runtime.waitForMfReady ?? true,
    loadingIndicator: runtime.loadingIndicator ?? "spinner",
    ...(runtime.allowedRemoteOrigins ? { allowedRemoteOrigins: runtime.allowedRemoteOrigins } : {})
  };
}
