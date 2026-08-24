import type { AtlasDomIsolation } from './atlas-dom-isolation.js';
import type { AtlasExposeMap } from './atlas-expose-map.js';
import type { AtlasFramework } from './atlas-framework.js';
import type { AtlasMetadata } from './atlas-metadata.js';
import type { AtlasPlacement } from './atlas-placement.js';

export type AtlasArtifactKind = 'app' | 'host';

export interface AtlasManifestDescriptor {
  path: string;
  digest: `sha256:${string}`;
  size: number;
  mediaType: 'application/json';
}

export interface AtlasPayloadFileDescriptor {
  path: string;
  digest: `sha256:${string}`;
  size: number;
  mediaType: string;
  cacheControl: string;
  role: 'remote-entry' | 'script' | 'stylesheet' | 'asset' | 'source-map';
}

export interface AtlasReleaseIdentity {
  version: string;
}

export interface AtlasPreviewIdentity {
  number: number;
  gitSha: string;
  gitBranch?: string;
  gitCommitTitle?: string;
}

export interface AtlasArtifactSource {
  gitSha?: string;
  gitBranch?: string;
  gitCommitTitle?: string;
}

export interface AtlasArtifactStylesheet {
  path: string;
  integrity: string;
}

export interface AtlasPublishedWidgetManifest {
  schemaVersion: '1';
  id: string;
  name: string;
  ownerAppId: string;
  framework: AtlasFramework;
  expose: string;
  contractVersion: '1';
  metadata?: AtlasMetadata;
}

export interface AtlasArtifactManifestBaseV2 {
  schemaVersion: '2';
  kind: 'app-artifact' | 'host-artifact';
  id: string;
  name: string;
  packageName?: string;
  release?: AtlasReleaseIdentity;
  preview?: AtlasPreviewIdentity;
  source?: AtlasArtifactSource;
  framework: AtlasFramework;
  entryPath: string;
  exposes: AtlasExposeMap;
  styles?: AtlasArtifactStylesheet[];
  files: AtlasPayloadFileDescriptor[];
}

export interface AtlasAppArtifactManifest extends AtlasArtifactManifestBaseV2 {
  kind: 'app-artifact';
  isolation?: AtlasDomIsolation;
  exportedWidgets?: AtlasPublishedWidgetManifest[];
  externalAppsDependencies?: string[];
  requiredHostSdkVersion: string;
  supportedHosts: string[];
  placements: AtlasPlacement[];
  metadata?: AtlasMetadata;
}

export interface AtlasHostArtifactManifest extends AtlasArtifactManifestBaseV2 {
  kind: 'host-artifact';
  requiredLoaderApiVersion: string;
}

export type AtlasPublishedArtifactManifest =
  AtlasAppArtifactManifest | AtlasHostArtifactManifest;

export interface AtlasRegistryArtifact {
  id: string;
  name: string;
  packageName?: string;
  releases: Record<string, AtlasManifestDescriptor>;
  previews: Record<string, AtlasManifestDescriptor>;
  latest?: string;
}

export interface AtlasDeploymentSelection {
  version: string;
}

export interface AtlasHostDeploymentSelection extends AtlasDeploymentSelection {
  /** Public base URLs that serve this host in this environment. */
  baseUrls?: string[];
  /** External registries this host may use in this environment. */
  externalRegistries?: Array<{ registryUrl: string; environment: string }>;
}

export interface AtlasEnvironmentDeployment {
  hosts: Record<string, AtlasHostDeploymentSelection>;
  apps: Record<string, AtlasDeploymentSelection>;
  expectedHostRevisions: Record<string, string>;
}

export interface AtlasDeploymentManifestReference extends AtlasManifestDescriptor {
  url: string;
}

export interface AtlasHostDeploymentManifest {
  schemaVersion: '2';
  kind: 'host-deployment';
  hostId: string;
  environment: string;
  deploymentRevision: string;
  host: AtlasDeploymentManifestReference;
  apps: AtlasDeploymentManifestReference[];
  widgetProviders?: AtlasDeploymentManifestReference[];
}
