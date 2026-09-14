import type { AtlasExtensionManifest } from '../../../types/contracts';

export function uniqueVersions(
  versions: AtlasExtensionManifest[],
): AtlasExtensionManifest[] {
  return [
    ...new Map(
      versions.map((version) => [versionKey(version), version]),
    ).values(),
  ];
}

export function versionKey(manifest: AtlasExtensionManifest): string {
  if (manifest.channel === 'pr') {
    return `pr:${manifest.prNumber ?? manifest.version}:${manifest.buildId}`;
  }

  return `${manifest.channel}:${manifest.version}:${manifest.buildId}`;
}
