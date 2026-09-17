import type { ArtifactVersion } from './artifact-version';

export const OVERRIDE_TYPES = ['custom', 'production', 'pr'] as const;
export type OverrideType = (typeof OVERRIDE_TYPES)[number];

export interface ArtifactOverride {
  deployedArtifactVersion: ArtifactVersion;
  selectedOverrideArtifactVersion: ArtifactVersion | undefined;
  overrideEnabled: boolean;
}

export interface ArtifactTableRow extends ArtifactOverride {
  overrideType: OverrideType | undefined;
  sourceDescription: string;
  loadError: string | undefined;
  canToggle: boolean;
  visible: boolean;
}

export interface OverrideSelection {
  type: OverrideType;
  value: string;
}

export interface ArtifactOverrideOptions extends ArtifactOverride {
  productionArtifactVersions: ArtifactVersion[];
  prArtifactVersions: ArtifactVersion[];
}
