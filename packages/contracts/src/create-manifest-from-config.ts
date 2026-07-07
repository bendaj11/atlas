import type { AtlasManifest } from "./atlas-manifest.js";
import type { CreateManifestFromConfigInput } from "./create-manifest-from-config-input.js";
import { assertAtlasManifest } from "./assert-atlas-manifest.js";

/** Builds the manifest JSON a host needs to load one app build. */
export function createManifestFromConfig(input: CreateManifestFromConfigInput): AtlasManifest {
  const manifest: AtlasManifest = {
    schemaVersion: "1",
    id: input.config.id,
    name: input.config.name ?? input.config.id,
    version: input.version,
    buildId: input.buildId,
    channel: input.channel ?? "production",
    framework: input.config.framework,
    isolation: input.config.isolation ?? "scoped",
    remoteEntryUrl: input.remoteEntryUrl,
    exposes: { entry: "./entry" },
    requiredHostSdkVersion: input.config.requiredHostSdkVersion ?? "^0.1.0",
    supportedHosts: input.config.hostCompatibility ?? ["*"],
    placements: input.config.placements ?? [],
    createdAt: input.createdAt ?? new Date().toISOString()
  };

  if (input.exportedComponents?.length) {
    manifest.exportedComponents = input.exportedComponents;
  }

  if (input.styles?.length) manifest.styles = input.styles;

  if (input.config.uses?.length) manifest.uses = [...input.config.uses];

  if (input.integrity) manifest.integrity = input.integrity;

  if (input.gitSha) {
    manifest.gitSha = input.gitSha;
  }

  if (input.prNumber) {
    manifest.prNumber = input.prNumber;
  }

  assertAtlasManifest(manifest);
  return manifest;
}
