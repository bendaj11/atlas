import type { AtlasManifest } from "./atlas-manifest.js";
import type { AtlasAppConfig } from "./atlas-config.js";
import type { AtlasPlacement } from "./atlas-placement.js";
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
    isolation: input.config.domIsolation ?? "scoped",
    remoteEntryUrl: input.remoteEntryUrl,
    exposes: { entry: "./entry" },
    requiredHostSdkVersion: input.config.requiredHostSdkVersion ?? "^0.1.0",
    supportedHosts: supportedHosts(input.config),
    placements: placements(input.config),
    createdAt: input.createdAt ?? new Date().toISOString()
  };

  if (input.exportedWidgets?.length) {
    manifest.exportedWidgets = input.exportedWidgets;
  }

  if (input.styles?.length) manifest.styles = input.styles;

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

function placements(config: AtlasAppConfig): AtlasPlacement[] {
  return [
    ...(config.routes ?? []).map((route, index, routes) => ({
      id: routePlacementId(route.hostId, route.basePath, routes.slice(0, index)),
      kind: "route" as const,
      hostId: route.hostId,
      route: {
        basePath: route.basePath,
        ...(route.title !== undefined ? { title: route.title } : {}),
        ...(route.nav ? { nav: route.nav } : {})
      }
    })),
    ...(config.slots ?? []).map((slot) => ({
      id: slot.id,
      kind: "slot" as const,
      hostId: slot.hostId,
      slot: slot.name
    }))
  ];
}

function supportedHosts(config: AtlasAppConfig): string[] {
  const hosts = [...new Set(placements(config).map((placement) => placement.hostId))];
  return hosts.length ? hosts : ["*"];
}

function routePlacementId(hostId: string, basePath: string, previousRoutes: readonly { hostId: string; basePath: string }[]): string {
  const baseId = identifierFromRoute(hostId, basePath);
  const duplicateCount = previousRoutes.filter((route) => identifierFromRoute(route.hostId, route.basePath) === baseId).length;
  return duplicateCount === 0 ? baseId : `${baseId}-${duplicateCount + 1}`;
}

function identifierFromRoute(hostId: string, basePath: string): string {
  const value = `${hostId}-${basePath}`.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return value ? `${value}-route` : "route";
}
