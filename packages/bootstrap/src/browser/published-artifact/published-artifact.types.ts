import type {
  AtlasHostRuntimeConfig,
  AtlasManifestDescriptor,
  hydratePublishedArtifactManifest,
} from '@atlas/schema';
import type { fetchBytes } from '../fetch-json/index.js';

export interface PublishedArtifactDependencies {
  readonly fetchBytes: typeof fetchBytes;
  readonly hydratePublishedArtifactManifest: typeof hydratePublishedArtifactManifest;
}

export interface LoadPublishedArtifactOptions {
  reference: AtlasManifestDescriptor;
  runtime: AtlasHostRuntimeConfig;
  dependencies?: PublishedArtifactDependencies;
}
