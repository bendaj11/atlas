import type { ArtifactVersion, AtlasHostData as HostData } from './contracts';

export type OverrideType = 'custom' | 'production' | 'pr';
export type Scope = 'all' | 'tab';
export type HostStatus = 'LOADING' | 'ERROR' | 'LOADED';
export type OverrideStatus = 'IDLE' | 'APPLYING' | 'ERROR';

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

export interface ArtifactProps {
  artifact: Artifact;
}

export interface ColumbusState {
  hostData: HostData;
  tabId: number;
  enabledArtifactVersionOverrides: Map<string, ArtifactVersion>;
  disabledArtifactVersionOverrides: Map<string, ArtifactVersion>;
  clearedLocalArtifactIds: Set<string>;
  scope: Scope;
}

export type { ArtifactVersion };
