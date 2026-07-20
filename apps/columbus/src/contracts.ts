export type AtlasReleaseChannel = "production" | "pr" | "local";

export interface AtlasExtensionManifest {
  schemaVersion: "1";
  kind: "host" | "app";
  id: string;
  name: string;
  version: string;
  buildId: string;
  channel: AtlasReleaseChannel;
  framework: "angular" | "react" | "vue";
  gitSha?: string;
  gitBranch?: string;
  gitCommitTitle?: string;
  prNumber?: number;
  createdAt?: string;
  remoteEntryUrl: string;
  integrity?: string;
  styles?: Array<{ href: string; integrity?: string }>;
  exportedWidgets?: Array<{ remoteEntryUrl: string }>;
  requiredHostSdkVersion?: string;
  requiredLoaderApiVersion?: string;
  supportedHosts?: string[];
  placements?: Array<{ hostId: string }>;
  exposes?: { entry: string };
  externalAppsDependencies?: string[];
}

export interface AtlasArtifactOverride {
  appId: string;
  manifest: AtlasExtensionManifest;
  reason: "local" | "pr" | "historical";
}

export interface AtlasOverrideDocument {
  schemaVersion: "1";
  hostId: string;
  overrides: AtlasArtifactOverride[];
  hostOverride?: AtlasExtensionManifest;
  generatedAt: string;
}

export interface AtlasHostData {
  config: {
    schemaVersion: "1";
    hostId: string;
    catalogUrl: string;
    allowCustomOverrides?: boolean;
    externalRegistryUrls?: string[];
  };
  pageUrl: string;
  catalog: {
    schemaVersion: "1";
    hostId: string;
    revision: string;
    host: AtlasExtensionManifest;
    apps: AtlasExtensionManifest[];
    widgetProviders?: AtlasExtensionManifest[];
  };
  versions: Record<string, AtlasExtensionManifest[]>;
  overrides: AtlasOverrideDocument | undefined;
  overrideScope: "all" | "tab" | undefined;
  runtimeErrors: string[];
  versionErrors: string[];
}

export function artifactKey(manifest: AtlasExtensionManifest): string {
  return `${manifest.kind}:${manifest.id}`;
}
