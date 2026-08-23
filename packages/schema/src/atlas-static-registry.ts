import type {
  AtlasEnvironmentDeployment,
  AtlasRegistryArtifact,
} from './atlas-publication.js';

/** Compact registry of immutable manifests and logical environment selections. */
export interface AtlasStaticRegistry {
  schemaVersion: '2';
  /** SHA-256 of Atlas canonical JSON excluding revision and updatedAt. */
  revision: `sha256:${string}`;
  updatedAt: string;
  hosts: Record<string, AtlasRegistryArtifact>;
  apps: Record<string, AtlasRegistryArtifact>;
  deployments: Record<string, AtlasEnvironmentDeployment>;
}
