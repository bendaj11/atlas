import type {
  AtlasEnvironmentDeployment,
  AtlasHostDeploymentManifest,
  AtlasPublishedArtifactManifest,
} from '@atlas/schema';
import type { AtlasPublicationStorage } from '../publication/index.js';

export interface AtlasDeployResult {
  artifactId: string;
  environment: string;
  version: string;
  registryRevision: string;
  dryRun: boolean;
}

export interface RegistryLocations {
  source: string;
  target: string;
}

export interface RegistryAccess {
  storage: AtlasPublicationStorage;
  locations: RegistryLocations;
  manifests: Map<string, AtlasPublishedArtifactManifest>;
}

export type ArtifactKind = 'app' | 'host';

export interface ArtifactSelection {
  kind: ArtifactKind;
  id: string;
  version: string;
}

export interface DeploymentWrite {
  state: AtlasEnvironmentDeployment;
  manifests: AtlasHostDeploymentManifest[];
}
