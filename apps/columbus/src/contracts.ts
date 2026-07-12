export type AtlasReleaseChannel = "production" | "pr" | "historical" | "local";

export interface AtlasExtensionManifest {
  schemaVersion: "1";
  id: string;
  name: string;
  version: string;
  buildId: string;
  channel: AtlasReleaseChannel;
  framework: "angular" | "react" | "vue";
  prNumber?: number;
  createdAt?: string;
  remoteEntryUrl: string;
  requiredHostSdkVersion: string;
  supportedHosts: string[];
  placements: Array<{ hostId: string }>;
}

export interface AtlasRuntimeOverride {
  appId: string;
  manifest: AtlasExtensionManifest;
  reason: "local" | "pr" | "historical";
}

export interface AtlasOverrideDocument {
  schemaVersion: "1";
  hostId: string;
  overrides: AtlasRuntimeOverride[];
  generatedAt: string;
}

export interface AtlasHostData {
  config: { schemaVersion: "1"; hostId: string; catalogUrl: string };
  catalog: { schemaVersion: "1"; hostId: string; manifests: AtlasExtensionManifest[] };
  versions: Record<string, AtlasExtensionManifest[]>;
  overrides: AtlasOverrideDocument | undefined;
  overrideScope: "all" | "tab" | undefined;
  runtimeErrors: string[];
  versionErrors: string[];
}
