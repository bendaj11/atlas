type AtlasReleaseChannel = 'production' | 'pr' | 'local';

export interface AtlasExtensionWidgetManifest {
  schemaVersion: '1';
  id: string;
  name: string;
  ownerAppId: string;
  framework: 'angular' | 'react' | 'vue';
  remoteEntryUrl: string;
  expose: string;
  contractVersion: '1';
  metadata?: Record<string, string | number | boolean>;
}

export interface AtlasExtensionManifest {
  schemaVersion: '1';
  kind: 'host' | 'app';
  id: string;
  name: string;
  version: string;
  buildId: string;
  channel: AtlasReleaseChannel;
  framework: 'angular' | 'react' | 'vue';
  gitSha?: string;
  gitBranch?: string;
  gitCommitTitle?: string;
  prNumber?: number;
  createdAt?: string;
  remoteEntryUrl: string;
  integrity?: string;
  styles?: Array<{ href: string; integrity?: string }>;
  exportedWidgets?: AtlasExtensionWidgetManifest[];
  requiredHostSdkVersion?: string;
  requiredLoaderApiVersion?: string;
  supportedHosts?: string[];
  placements?: Array<{ hostId: string }>;
  exposes?: { entry: string };
  externalAppsDependencies?: string[];
  isolation?: 'shared-dom' | 'shadow-dom' | 'scoped';
  metadata?: Record<string, string | number | boolean>;
}

export type ArtifactVersion = AtlasExtensionManifest;
