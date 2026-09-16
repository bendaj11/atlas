import type { ArtifactVersion } from './artifact-version';

export type OverrideType = 'custom' | 'production' | 'pr';

export interface Artifact {
  key: string;
  productionArtifactVersion: ArtifactVersion;
  selectedArtifactVersion: ArtifactVersion | undefined;
  overrideType: OverrideType | undefined;
  sourceDescription: string;
  loadError: string | undefined;
  overrideEnabled: boolean;
  canToggle: boolean;
  visible: boolean;
}

export interface OverrideSelection {
  type: OverrideType;
  value: string;
}

export interface ArtifactConfiguration extends Artifact {
  hostId: string;
  productionArtifactVersions: ArtifactVersion[];
  prArtifactVersions: ArtifactVersion[];
}
