import type {
  AtlasExtensionManifest as Manifest,
  AtlasHostData as HostData,
} from '../contracts.js';

export type OverrideType = 'none' | 'custom' | 'production' | 'pr';
export type Scope = 'all' | 'tab';
export type HostStatus = 'RESTORING' | 'LOADING' | 'ERROR' | 'LOADED';
export type OverrideStatus = 'IDLE' | 'APPLYING' | 'ERROR';

export interface ArtifactSelection {
  productionManifest: Manifest;
  selectedManifest: Manifest | undefined;
}

export interface Artifact extends ArtifactSelection {
  id: string;
  overrideType: OverrideType;
  sourceDescription: string;
  loadError: string | undefined;
  overrideEnabled: boolean;
  canToggle: boolean;
}

export interface EditorDraft {
  type: Exclude<OverrideType, 'none'>;
  customUrl: string;
  productionKey: string;
  prKey: string;
}

export interface ArtifactConfiguration extends Pick<
  Artifact,
  'id' | 'productionManifest' | 'selectedManifest'
> {
  hostId: string;
  allowCustomOverrides: boolean;
  productionOptions: Manifest[];
  prOptions: Manifest[];
}

export interface ArtifactProps {
  artifact: Artifact;
}

export interface PopupSession {
  hostData: HostData;
  tabId: number;
  activeOverrides: Map<string, Manifest>;
  disabledOverrides: Map<string, Manifest>;
  scope: Scope;
}

export type { Manifest };
