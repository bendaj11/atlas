import type { AtlasExtensionManifest as Manifest } from "../contracts.js";

export type OverrideType = "none" | "custom" | "production" | "pr";
export type Scope = "all" | "tab";
export type StatusTone = "standard" | "error";
export type View = { name: "dashboard" } | { name: "editor"; artifactKey: string };

export interface AppViewModel {
  production: Manifest;
  selected: Manifest | undefined;
  overrideType: OverrideType;
  currentUrl: string;
  overrideEnabled: boolean;
  canToggle: boolean;
}

export interface EditorDraft {
  type: Exclude<OverrideType, "none">;
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

export interface StatusState {
  busy: boolean;
  message: string;
  tone: StatusTone;
}

export interface SaveOverrideValue {
  production: Manifest;
  selected: Manifest | undefined;
}

export type { Manifest };
