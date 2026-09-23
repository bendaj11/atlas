import type {
  AtlasHostManifest,
  AtlasManifest,
  AtlasManifestDescriptor,
} from '@atlas/schema';
import type { AtlasRetryPolicy } from '../../resilience/resilience.types.js';
import type { FetchBytes } from '../fetch-bytes.js';

export type PublishedManifest = AtlasManifest | AtlasHostManifest;

export type DeploymentManifestReference = AtlasManifestDescriptor & {
  url?: string;
};

export type ResolvedManifestReference = AtlasManifestDescriptor & {
  url: string;
};

export interface LoadHostDeploymentOptions {
  manifestUrl: string;
  /** Root used to resolve manifest references that carry only a relative path. */
  artifactRegistryUrl?: string;
  expectedHostId?: string;
  expectedEnvironment?: string;
  fetchBytes?: FetchBytes;
  requestPolicy?: AtlasRetryPolicy;
}

export interface LoadPublishedManifestOptions {
  reference: ResolvedManifestReference;
  fetchBytes?: FetchBytes;
  requestPolicy?: AtlasRetryPolicy;
}
