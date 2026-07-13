import type { AtlasExtensionManifest } from "./contracts.js";

export function assertExtensionManifest(value: AtlasExtensionManifest): void {
  if (value.schemaVersion !== "1" || !value.kind || !value.id || !value.version || !value.buildId || !value.remoteEntryUrl) {
    throw new Error("The local URL did not return a valid Atlas manifest.");
  }
}

export function supportsHost(manifest: AtlasExtensionManifest, hostId: string): boolean {
  if (manifest.kind === "host") return manifest.id === hostId;
  return manifest.supportedHosts?.includes("*") === true
    || manifest.supportedHosts?.includes(hostId) === true
    || manifest.placements?.some((placement) => placement.hostId === hostId) === true;
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
