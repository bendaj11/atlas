import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AtlasConfig, AtlasHostConfig, AtlasHostRuntimeConfig } from "@atlas/schema";
import { CliArguments } from "./arguments.js";

const DEFAULT_LOCAL_REGISTRY_BASE_URL = "http://127.0.0.1:4400";

export async function writeHostRuntimeConfig(options: {
  project: { root: string; version: string };
  config: AtlasConfig;
  args: CliArguments;
}): Promise<{ path: string; config: AtlasHostRuntimeConfig }> {
  const { project, config, args } = options;
  const runtimeConfig = createHostRuntimeConfig(config, args, project.version);
  const output = resolve(args.flag("out") ?? `${project.root}/public/atlas.runtime.json`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(runtimeConfig, null, 2)}\n`, "utf8");
  return { path: output, config: runtimeConfig };
}

export function createHostRuntimeConfig(
  config: AtlasConfig,
  args = new CliArguments([]),
  hostVersion?: string
): AtlasHostRuntimeConfig {
  assertHostConfig(config);
  return {
    schemaVersion: "1",
    hostId: config.id,
    ...(hostVersion ? { hostVersion } : {}),
    catalogUrl: `${trimSlash(args.flag("registry-base-url") ?? process.env.ATLAS_REGISTRY_BASE_URL ?? DEFAULT_LOCAL_REGISTRY_BASE_URL)}/hosts/${config.id}/catalog.json`,
    allowAppOverrides: config.allowAppOverrides ?? true,
    resourcesTimeoutMs: config.resourcesTimeoutMs ?? 15000,
    resourcesRetryCount: config.resourcesRetryCount ?? 3
  };
}

function assertHostConfig(config: AtlasConfig): asserts config is AtlasHostConfig {
  if (config.type === "app" || "routes" in config || "slots" in config || "domIsolation" in config || "requiredHostSdkVersion" in config) {
    throw new Error(`Atlas host build expects a host config for "${config.id}", but received an app config.`);
  }
}

function trimSlash(value: string): string {
  return value.replace(/\/$/, "");
}
