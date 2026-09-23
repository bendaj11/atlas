import type { ArtifactVersion } from './artifact-version';

export interface AtlasArtifactOverride {
  appId: string;
  manifest: ArtifactVersion;
  reason: 'local' | 'pr' | 'historical';
}

export interface AtlasOverrideDocument {
  schemaVersion: '1';
  hostId: string;
  overrides: AtlasArtifactOverride[];
  hostOverride?: ArtifactVersion;
  generatedAt: string;
}
