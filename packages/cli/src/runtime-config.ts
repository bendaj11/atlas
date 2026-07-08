import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AtlasConfig, AtlasHostConfig, AtlasHostRuntimeConfig } from "@atlas/schema";
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
    const config = createHostRuntimeConfig(source, this.args);
    const output = resolve(this.args.flag("out") ?? `${project.root}/public/atlas.runtime.json`);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    return { path: output, config };
  }
}

export function createHostRuntimeConfig(config: AtlasConfig, args = new CliArguments([])): AtlasHostRuntimeConfig {
  assertHostConfig(config);
  return {
    schemaVersion: "1",
    hostId: config.id,
    catalogUrl: `${trimSlash(args.flag("registry-base-url") ?? process.env.ATLAS_REGISTRY_BASE_URL ?? "http://localhost:4400")}/hosts/${config.id}/catalog.json`,
    allowAppOverrides: config.allowAppOverrides ?? true,
    resourcesTimeoutMs: config.resourcesTimeoutMs ?? 15000,
    resourcesRetryCount: config.resourcesRetryCount ?? 3
  };
}

function assertHostConfig(config: AtlasConfig): asserts config is AtlasHostConfig {
  if ("routes" in config || "slots" in config || "domIsolation" in config || "requiredHostSdkVersion" in config) {
    throw new Error(`Atlas runtime-config expects a host config for "${config.id}", but received an app config.`);
  }
}

function trimSlash(value: string): string {
  return value.replace(/\/$/, "");
}
