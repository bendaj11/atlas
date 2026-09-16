import type { AtlasHostManifest, AtlasManifest } from '@atlas/schema';

export type ArtifactVersion = AtlasManifest | AtlasHostManifest;

export function isAppArtifactVersion(
  artifactVersion: ArtifactVersion,
): artifactVersion is AtlasManifest {
  return artifactVersion.kind === 'app';
}
