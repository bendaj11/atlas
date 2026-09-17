import type {
  AtlasArtifactKind,
  AtlasManifestDescriptor,
  AtlasRegistryArtifact,
  AtlasStaticRegistry,
} from '@atlas/schema';

export interface AtlasRegistryMutation {
  registry: AtlasStaticRegistry;
  baseRevision: string;
  registryRevision: string;
  changed: boolean;
  replacedPreview?: AtlasManifestDescriptor;
}

export interface AtlasResolvedArtifact {
  kind: AtlasArtifactKind;
  artifact: AtlasRegistryArtifact;
}

export interface AtlasResolvedRelease extends AtlasResolvedArtifact {
  version: string;
  manifest: AtlasManifestDescriptor;
}
