import type {
  AtlasExtensionManifest as Manifest,
  AtlasHostData as HostData,
} from '../contracts.js';

export type OverrideType = 'none' | 'custom' | 'production' | 'pr';
export type Scope = 'all' | 'tab';
export type HostStatus = 'LOADING' | 'ERROR' | 'LOADED';
export type OverrideStatus = 'IDLE' | 'APPLYING' | 'ERROR';

export interface AppViewModel {
  production: Manifest;
  selected: Manifest | undefined;
  overrideType: OverrideType;
  sourceDescription: string;
  overrideEnabled: boolean;
  canToggle: boolean;
}

export interface EditorDraft {
  type: Exclude<OverrideType, 'none'>;
  customUrl: string;
  productionKey: string;
  prKey: string;
}

export interface EditorModel {
  hostId: string;
  allowCustomOverrides: boolean;
  production: Manifest;
  selected: Manifest | undefined;
  productionOptions: Manifest[];
  prOptions: Manifest[];
}

export interface SaveOverrideValue {
  production: Manifest;
  selected: Manifest | undefined;
}

export interface PopupSession {
  hostData: HostData;
  tabId: number;
  activeOverrides: Map<string, Manifest>;
  disabledOverrides: Map<string, Manifest>;
  scope: Scope;
}

export type { Manifest };
