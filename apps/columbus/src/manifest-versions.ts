import type { AtlasExtensionManifest } from './contracts.js';

export function supportsHost({
  manifest,
  hostId,
}: {
  manifest: AtlasExtensionManifest;
  hostId: string;
}): boolean {
  if (manifest.kind === 'host') return manifest.id === hostId;
  return (
    manifest.supportedHosts?.includes('*') === true ||
    manifest.supportedHosts?.includes(hostId) === true ||
    manifest.placements?.some((placement) => placement.hostId === hostId) ===
      true
  );
}

export function uniqueVersions(
  values: AtlasExtensionManifest[],
): AtlasExtensionManifest[] {
  return [
    ...new Map(values.map((value) => [versionKey(value), value])).values(),
  ].sort((left, right) => {
    const channel = channelRank(left.channel) - channelRank(right.channel);
    if (channel) return channel;
    return (
      (right.createdAt ?? '').localeCompare(left.createdAt ?? '') ||
      right.version.localeCompare(left.version, undefined, {
        numeric: true,
        sensitivity: 'base',
      }) ||
      right.buildId.localeCompare(left.buildId)
    );
  });
}

export function versionKey(manifest: AtlasExtensionManifest): string {
  return `${manifest.channel}:${manifest.version}:${manifest.buildId}`;
}

function channelRank(channel: AtlasExtensionManifest['channel']): number {
  if (channel === 'production') return 0;
  if (channel === 'pr') return 1;
  return 2;
}
