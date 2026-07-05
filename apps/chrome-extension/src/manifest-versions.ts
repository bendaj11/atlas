import type { AtlasExtensionManifest } from "./contracts.js";

export function assertExtensionManifest(value: AtlasExtensionManifest): void {
  if (value.schemaVersion !== "1" || !value.id || !value.version || !value.buildId || !value.remoteEntryUrl || !Array.isArray(value.supportedHosts) || !Array.isArray(value.placements)) {
    throw new Error("The local URL did not return a valid Atlas manifest.");
  }
}

export function supportsHost(manifest: AtlasExtensionManifest, hostId: string): boolean {
  return manifest.supportedHosts.includes("*")
    || manifest.supportedHosts.includes(hostId)
    || manifest.placements.some((placement) => placement.hostId === hostId);
}

export function uniqueVersions(values: AtlasExtensionManifest[]): AtlasExtensionManifest[] {
  return [...new Map(values.map((value) => [versionKey(value), value])).values()].sort((left, right) => {
    if (left.channel === "production") return -1;
    if (right.channel === "production") return 1;
    return right.createdAt?.localeCompare(left.createdAt ?? "") ?? 0;
  });
}

export function versionKey(manifest: AtlasExtensionManifest): string {
  return `${manifest.channel}:${manifest.version}:${manifest.buildId}`;
}
