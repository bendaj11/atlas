import type { AtlasDomIsolation } from '../manifest/atlas-dom-isolation.js';
import type { AtlasExposeMap } from '../manifest/atlas-expose-map.js';
import type { AtlasFramework } from '../manifest/atlas-framework.js';
import type { AtlasMetadata } from '../manifest/atlas-metadata.js';
import type { AtlasPlacement } from '../manifest/atlas-placement/atlas-placement.js';

export type AtlasArtifactKind = 'app' | 'host';

export const ATLAS_PAYLOAD_FILE_ROLES = [
  'remote-entry',
  'script',
  'stylesheet',
  'asset',
  'source-map',
] as const;

export type AtlasPayloadFileRole = (typeof ATLAS_PAYLOAD_FILE_ROLES)[number];

export const ATLAS_IMMUTABLE_CACHE_CONTROL =
  'public, max-age=31536000, immutable';

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
  role: AtlasPayloadFileRole;
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

export type AtlasHostDeploymentSelection = AtlasDeploymentSelection;

export interface AtlasEnvironmentDeployment {
  schemaVersion: 'v1';
  environment: string;
  revision: `sha256:${string}`;
  updatedAt: string;
  hosts: Record<string, AtlasHostDeploymentSelection>;
  apps: Record<string, AtlasDeploymentSelection>;
}

export interface AtlasDeploymentManifestReference extends AtlasManifestDescriptor {
  url?: string;
}

export interface AtlasHostDeploymentManifest {
  schemaVersion: 'v1';
  kind: 'host-deployment';
  hostId: string;
  environment: string;
  deploymentRevision: string;
  host: AtlasDeploymentManifestReference;
  apps: AtlasDeploymentManifestReference[];
  widgetProviders?: AtlasDeploymentManifestReference[];
}
