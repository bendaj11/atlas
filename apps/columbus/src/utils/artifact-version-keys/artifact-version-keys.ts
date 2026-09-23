import type { ArtifactVersion } from '../../types/artifact-version';

export function uniqueVersions(versions: ArtifactVersion[]): ArtifactVersion[] {
  return [
    ...new Map(
      versions.map((version) => [versionKey(version), version]),
    ).values(),
  ];
}

export function versionKey(artifactVersion: ArtifactVersion): string {
  if (artifactVersion.channel === 'pr') {
    return `pr:${artifactVersion.prNumber ?? artifactVersion.version}:${artifactVersion.buildId}`;
  }

  return `${artifactVersion.channel}:${artifactVersion.version}:${artifactVersion.buildId}`;
}
