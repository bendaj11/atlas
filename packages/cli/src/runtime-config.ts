import type { AtlasConfig, AtlasHostConfig, AtlasHostRuntimeConfig } from "@atlas/schema";
import { CliArguments } from "./arguments.js";

const DEFAULT_LOCAL_REGISTRY_BASE_URL = "http://localhost:4400";

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
    allowCustomOverrides: config.allowCustomOverrides ?? config.allowOverrides ?? false,
    resourcesTimeoutMs: config.resourcesTimeoutMs ?? 15000,
    resourcesRetryCount: config.resourcesRetryCount ?? 3,
    ...optionalUrlList("asset-origins", args.flag("asset-origins")),
    ...optionalUrlList("external-registry-urls", args.flag("external-registry-urls"))
  };
}

function optionalUrlList(
  kind: "asset-origins" | "external-registry-urls",
  value: string | undefined
): Pick<AtlasHostRuntimeConfig, "assetOrigins" | "externalRegistryUrls"> {
  if (!value) return {};
  const urls = [...new Set(value.split(/[\s,]+/).filter(Boolean).map((entry) => {
    const url = new URL(entry);
    if (url.protocol !== "https:" && !isLoopbackUrl(url)) {
      throw new Error(`--${kind} must contain HTTPS URLs or loopback URLs for local development.`);
    }
    return kind === "asset-origins" ? url.origin : url.href.replace(/\/$/, "");
  }))];
  return kind === "asset-origins" ? { assetOrigins: urls } : { externalRegistryUrls: urls };
}

function isLoopbackUrl(url: URL): boolean {
  return (url.protocol === "http:" || url.protocol === "https:")
    && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

function assertHostConfig(config: AtlasConfig): asserts config is AtlasHostConfig {
  if (config.type === "app" || "routes" in config || "slots" in config || "domIsolation" in config || "requiredHostSdkVersion" in config) {
    throw new Error(`Atlas bootstrap build expects a host config for "${config.id}", but received an app config.`);
  }
}

function trimSlash(value: string): string {
  return value.replace(/\/$/, "");
}
