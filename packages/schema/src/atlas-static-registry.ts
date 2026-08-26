import type { AtlasRegistryArtifact } from './atlas-publication.js';

/** Immutable catalog of published artifacts. */
export interface AtlasStaticRegistry {
  schemaVersion: '2';
  /** SHA-256 of Atlas canonical JSON excluding revision and updatedAt. */
  revision: `sha256:${string}`;
  updatedAt: string;
  hosts: Record<string, AtlasRegistryArtifact>;
  apps: Record<string, AtlasRegistryArtifact>;
}
