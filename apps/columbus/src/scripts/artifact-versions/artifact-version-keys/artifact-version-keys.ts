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

export function versionKey(artifactVersion: AtlasExtensionManifest): string {
  if (artifactVersion.channel === 'pr') {
    return `pr:${artifactVersion.prNumber ?? artifactVersion.version}:${artifactVersion.buildId}`;
  }

  return `${artifactVersion.channel}:${artifactVersion.version}:${artifactVersion.buildId}`;
}
