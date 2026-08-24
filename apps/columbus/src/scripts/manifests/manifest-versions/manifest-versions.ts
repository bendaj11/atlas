import type { AtlasExtensionManifest } from '../../../types/contracts.js';

export function uniqueVersions(
  values: AtlasExtensionManifest[],
): AtlasExtensionManifest[] {
  return [
    ...new Map(values.map((value) => [versionKey(value), value])).values(),
  ].sort((left, right) => {
    const channel = channelRank(left.channel) - channelRank(right.channel);
    if (channel) return channel;
    return (right.createdAt ?? '').localeCompare(left.createdAt ?? '');
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
